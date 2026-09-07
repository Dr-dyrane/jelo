#!/usr/bin/env python3
"""Guided, source-bound Zapshot pipeline. No network, credentials or LLM API."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
ROLES = ('source_avatar', 'source_identity', 'source_text', 'media',
         'reply_avatar', 'reply_identity', 'reply_text')
CHECKS = ('source_identity_complete', 'source_text_complete', 'reply_identity_complete',
          'reply_text_complete', 'no_chrome_or_old_media', 'media_matches_source',
          'media_fully_visible', 'phone_readable', 'no_obstruction')
VERSION = 'jelocare-zapshot/2.0.0'
STATIC_LIMIT = 20
PAIR_LIMIT = 38.0
W, H, FPS = 1080, 1920, 20


class Stop(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise Stop(message)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def dump(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def ffmpeg():
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(args):
    result = subprocess.run([ffmpeg(), '-hide_banner', '-loglevel', 'error', *map(str, args)],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    require(result.returncode == 0, result.stderr.decode(errors='replace')[-4000:])
    return result.stdout


def metadata(path):
    reader = imageio_ffmpeg.read_frames(str(path), pix_fmt='rgb24')
    try:
        meta = next(reader)
        next(reader)  # a decodable frame is required, not a filename extension
    finally:
        reader.close()
    require(meta['duration'] > 0 and meta['duration'] <= 60,
            'MEDIA_DURATION: supply a complete clip between 0 and 60 seconds; do not silently trim.')
    result = subprocess.run([ffmpeg(), '-hide_banner', '-i', str(path), '-t', '0', '-f', 'null', '-'],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return {'width': meta['size'][0], 'height': meta['size'][1],
            'duration': meta['duration'], 'fps': meta['fps'],
            'audio': 'Audio:' in result.stderr.decode(errors='replace')}


def frame(path, at=0, size=None):
    args = ['-ss', str(at), '-i', path, '-frames:v', '1']
    if size:
        args += ['-vf', f'scale={size[0]}:{size[1]}']
    data = run([*args, '-f', 'image2pipe', '-vcodec', 'png', '-'])
    require(bool(data), f'FRAME_UNAVAILABLE at {at}; do not use an invented still.')
    return Image.open(io.BytesIO(data)).convert('RGB')


def sample_times(meta):
    # Stay before the last available frame PTS; avoid whole-loop aliases.
    last = max(0, meta['duration'] - 1 / max(1, meta['fps']) - .01)
    return sorted(set(round(last * part, 4) for part in (0, .21, .43, .68, 1)))


def exact_preset(inp):
    """Route by both original hashes, never by filename or visual similarity."""
    matches = [read(path) for path in sorted((ROOT/'presets').glob('*.json'))]
    matches = [p for p in matches if
               p['originalScreenshotSha256'] == inp['originalScreenshotSha256']
               and p['videoSha256'] == inp['videoSha256']]
    require(len(matches) <= 1, 'AMBIGUOUS_PRESET: exact pair has conflicting registered layouts.')
    return matches[0] if matches else None


def preset_regions(preset, inp):
    spec = dict(preset['regions'])
    spec['screenshotSha256'] = inp['screenshotSha256']
    return spec


def prepare(screenshot, video, case):
    screenshot, video, case = Path(screenshot).resolve(), Path(video).resolve(), Path(case).resolve()
    require(screenshot.is_file() and video.is_file(), 'MISSING_INPUT: supply screenshot AND matching video.')
    require(not case.exists(), 'CASE_EXISTS: choose a new case directory; originals are never overwritten.')
    meta = metadata(video)
    im = ImageOps.exif_transpose(Image.open(screenshot)).convert('RGB')
    require(im.width >= 320 and im.height >= 320, 'SOURCE_TOO_SMALL: use the original screenshot.')
    case.mkdir(parents=True)
    (case / 'assets').mkdir()
    shutil.copyfile(screenshot, case / 'assets' / ('original' + screenshot.suffix.lower()))
    im.save(case / 'assets/screenshot.png')
    shutil.copyfile(video, case / 'assets/media.mp4')
    record = {'schemaVersion': 2, 'originalScreenshotSha256': digest(screenshot),
              'screenshotSha256': digest(case / 'assets/screenshot.png'),
              'videoSha256': digest(video), 'coordinateSpace': {'width': im.width, 'height': im.height},
              'video': meta, 'renderer': VERSION}
    dump(case / 'input.json', record)
    inspect = im.copy()
    d = ImageDraw.Draw(inspect)
    font = ImageFont.load_default(size=max(18, round(im.width / 40)))
    step = max(100, round(im.width / 10 / 100) * 100)
    for x in range(0, im.width, step):
        d.line((x, 0, x, im.height), fill='#f8457e', width=2)
        d.text((x + 3, 3), str(x), fill='white', stroke_width=2, stroke_fill='black', font=font)
    for y in range(0, im.height, step):
        d.line((0, y, im.width, y), fill='#f8457e', width=2)
        d.text((3, y + 3), str(y), fill='white', stroke_width=2, stroke_fill='black', font=font)
    inspect.resize((720, round(im.height * 720 / im.width)), Image.Resampling.LANCZOS).save(case / 'inspect.png')
    samples = [frame(case / 'assets/media.mp4', t, (240, 240)) for t in sample_times(meta)]
    contact = Image.new('RGB', (240 * len(samples), 280), '#eeeeee')
    d = ImageDraw.Draw(contact)
    for i, (at, picture) in enumerate(zip(sample_times(meta), samples)):
        contact.paste(picture, (240 * i, 30))
        d.text((240 * i + 8, 6), f't={at}s', fill='black', font=ImageFont.load_default(size=16))
    contact.save(case / 'media-contact.png')
    dump(case / 'regions.template.json', {'schemaVersion': 2,
         'screenshotSha256': record['screenshotSha256'], 'videoSha256': record['videoSha256'],
         'coordinateSpace': record['coordinateSpace'], 'theme': 'dark', 'trace': 'LT-NEW',
         'source_media_match': False, 'regions': {r: None for r in ROLES}})
    preset = exact_preset(record)
    if preset:
        dump(case/'regions.json', preset_regions(preset, record))
        dump(case/'route.json', {'mode':'locked-exact-replay', 'presetId':preset['id'],
             'message':'Both original hashes match an approved pair. Every preview uses its canonical regions/layout; manual crop overrides are ignored.'})
    return record


def check_assets(case):
    inp = read(case / 'input.json')
    require(digest(case / 'assets/screenshot.png') == inp['screenshotSha256'], 'SCREENSHOT_CHANGED: prepare a new case.')
    require(digest(case / 'assets/media.mp4') == inp['videoSha256'], 'VIDEO_CHANGED: prepare a new case.')
    return inp


def overlap(a, b):
    return min(a[0]+a[2], b[0]+b[2]) > max(a[0], b[0]) and min(a[1]+a[3], b[1]+b[3]) > max(a[1], b[1])


def normalize_regions(spec, inp):
    require(spec.get('schemaVersion') == 2, 'SCHEMA: regions require schemaVersion 2.')
    require(spec.get('screenshotSha256') in (inp['screenshotSha256'], inp['originalScreenshotSha256'])
            and spec.get('videoSha256') == inp['videoSha256'], 'SOURCE_HASH_MISMATCH: never borrow example coordinates.')
    require(spec.get('source_media_match') is True, 'PAIR_REVIEW: view media-contact.png and screenshot first.')
    coord = spec.get('coordinateSpace', {})
    cw, ch = coord.get('width', 0), coord.get('height', 0)
    sw, sh = inp['coordinateSpace']['width'], inp['coordinateSpace']['height']
    require(isinstance(cw, (int,float)) and isinstance(ch, (int,float)) and cw > 0 and ch > 0,
            'COORDINATES: supply dimensions of the full image in which you measured.')
    require(abs((cw/ch)/(sw/sh)-1) < .003, 'COORDINATE_ASPECT: a cropped preview is not a coordinate space.')
    regions = {}
    require(set(spec.get('regions', {})) == set(ROLES), 'REGION_ROLES: exactly seven named regions required.')
    for role in ROLES:
        box = spec['regions'][role]
        require(isinstance(box, list) and len(box) == 4 and
                all(type(n) in (int,float) and math.isfinite(n) for n in box), f'{role}: use [x,y,width,height].')
        x,y,w,h = box
        require(x >= 0 and y >= 0 and w > 0 and h > 0 and x+w <= cw and y+h <= ch, f'{role}: crop outside source bounds.')
        x,y,w,h = [round(v * scale) for v,scale in zip(box,(sw/cw,sh/ch,sw/cw,sh/ch))]
        require(w >= 8 and h >= 8, f'{role}: empty or too small.')
        if 'avatar' in role:
            require(.9 < w/h < 1.1, f'{role}: select the complete square avatar, not a stretched rectangle.')
        regions[role] = [x,y,w,h]
    for i,a in enumerate(ROLES):
        for b in ROLES[i+1:]:
            require(not overlap(regions[a],regions[b]), f'CROP_OVERLAP: {a} includes part of {b}.')
    require(regions['source_text'][1] >= regions['source_identity'][1] and
            regions['media'][1] >= regions['source_text'][1]+regions['source_text'][3] and
            regions['reply_identity'][1] >= regions['media'][1]+regions['media'][3],
            'ANCESTRY_LAYOUT: expected complete source, media, then reply in screenshot.')
    require(spec.get('theme') in ('dark','light'), 'THEME: dark or light, matching source.')
    trace = spec.get('trace', 'LT-NEW')
    require(isinstance(trace,str) and 1 <= len(trace) <= 16 and all(c.isalnum() or c in '-· ' for c in trace),
            'TRACE: use a short plain trace label.')
    return regions


def crop(im, box):
    x,y,w,h = box
    return im.crop((x,y,x+w,y+h))


def check_crop_edges(im, regions, theme):
    """Reject cut foreground, not an OCR/completeness certificate.

    Native X avatars are circular. A narrow tangent/connector may touch an
    avatar edge; a broad cross-section means the circle was cut. Text needs
    clean padding. This catches partial glyphs even when an agent self-attests.
    """
    background = 0 if theme == 'dark' else 255
    for role, box in regions.items():
        if role == 'media':
            continue
        pixels = np.asarray(crop(im, box), dtype=float)
        foreground = np.max(np.abs(pixels-background), axis=2) > 60
        for edge in (foreground[0,:], foreground[-1,:], foreground[:,0], foreground[:,-1]):
            changes = np.diff(np.r_[0, edge.astype(int), 0])
            longest = max(np.flatnonzero(changes == -1)-np.flatnonzero(changes == 1), default=0)
            limit = max(12, round(len(edge)*.2)) if 'avatar' in role else 1
            require(longest <= limit,
                    f'CROP_EDGE: {role} cuts visible foreground at an edge ({longest} > {limit}). '
                    'Expand to include the complete circular avatar or add clean background padding around all text; inspect again. Do not change the limit.')


def source_pair_score(im, media_box, case, meta):
    screen = crop(im, media_box).resize((96,96), Image.Resampling.BILINEAR)
    a = np.asarray(screen, dtype=float)[8:-8,8:-8]
    values = []
    for t in sample_times(meta):
        b = np.asarray(frame(case/'assets/media.mp4', t, (96,96)), dtype=float)[8:-8,8:-8]
        values.append(float(np.abs(a-b).mean()))
    best = min(values)
    require(best <= PAIR_LIMIT, f'MEDIA_MISMATCH: best source-frame difference {best:.2f} > {PAIR_LIMIT}. Supply matching media; do not change thresholds.')
    return round(best, 4)


def make_layout(regions, meta, screenshot_width):
    def sized(role, maxw, height=None, scale=None):
        w,h = regions[role][2:]
        factor = min(maxw/w, height/h if height else scale)
        return [max(1,round(w*factor)), max(1,round(h*factor))]
    # One source-column scale, not a fixed height that crushes wrapped identities.
    column_scale = 864 / max(1, screenshot_width-regions['source_text'][0]-24)
    sizes = {'source_avatar': sized('source_avatar',114,height=114),
             'source_identity': sized('source_identity',864,scale=column_scale),
             'source_text': sized('source_text',864,scale=column_scale),
             'reply_avatar': sized('reply_avatar',114,height=114),
             'reply_identity': sized('reply_identity',864,scale=column_scale),
             'reply_text': sized('reply_text',864,scale=column_scale)}
    text_y = 236 + sizes['source_identity'][1] + 16
    # Align the moving box to 4:2:0 chroma cells so motion cannot bleed into
    # a neighbouring static row merely because the box starts on an odd pixel.
    media_y = math.ceil((text_y + sizes['source_text'][1] + 36) / 2) * 2
    reply_text_offset = 2 + sizes['reply_identity'][1] + 16
    reply_h = max(114, reply_text_offset+sizes['reply_text'][1])
    available_h = 1620 - media_y - 48 - reply_h
    ratio = meta['width']/meta['height']
    mw = math.floor(min(840, available_h*ratio) / 2) * 2
    mh = round(mw/ratio/2) * 2
    require(mw >= 300 and mh >= 150, 'CONTENT_TOO_TALL: this thread does not fit readably. Supply a shorter complete thread; never shrink text or cut words.')
    reply_y = media_y+mh+48
    pos = {'source_avatar':[38,230], 'source_identity':[176,236], 'source_text':[176,text_y],
           'reply_avatar':[38,reply_y], 'reply_identity':[176,reply_y+2], 'reply_text':[176,reply_y+reply_text_offset]}
    layout = {role: {'x':pos[role][0], 'y':pos[role][1], 'w':size[0], 'h':size[1]} for role,size in sizes.items()}
    layout['media'] = {'x':176,'y':media_y,'w':mw,'h':mh}
    return layout


def preview(case, regions_file):
    case = Path(case).resolve()
    require(not (case/'output').exists(), 'OUTPUT_EXISTS: use a new case before changing a completed output.')
    inp = check_assets(case)
    # Canonical routing is enforced here as well as in `run`: a weaker agent
    # cannot bypass an approved exact replay by choosing `prepare` instead.
    preset = exact_preset(inp)
    spec = preset_regions(preset, inp) if preset else read(regions_file)
    regions = normalize_regions(spec, inp)
    im = Image.open(case/'assets/screenshot.png').convert('RGB')
    check_crop_edges(im, regions, spec['theme'])
    pair_score = source_pair_score(im, regions['media'], case, inp['video'])
    layout = make_layout(regions, inp['video'], inp['coordinateSpace']['width'])
    if preset:
        layout = preset['layout']  # only a code-loaded, hash-matched preset; no user layout in schema
    # Sample native background from the avatar-to-body gap, excluding the connector.
    sa = regions['source_avatar']; st = regions['source_text']
    bg_x = min(im.width-1, sa[0]+sa[2]+5)
    bg = tuple(int(x) for x in np.median(np.asarray(im)[sa[1]:sa[1]+sa[3],bg_x:bg_x+3],axis=(0,1)))
    require((sum(bg)/3 < 60) if spec['theme']=='dark' else (sum(bg)/3 > 190), 'BACKGROUND: select source-matching theme and clean avatar crop.')
    base = Image.new('RGB',(W,H),bg)
    # Preserve a visible native connector stripe; never invent a connector from ancestry guesses.
    cx = sa[0]+sa[2]//2
    stripe = im.crop((cx-2,sa[1]+sa[3]+10,cx+3,sa[1]+sa[3]+50))
    delta = np.abs(np.asarray(stripe,dtype=float)-np.array(bg)).mean()
    if delta > 8 and delta < 160:
        y1=layout['source_avatar']['y']+layout['source_avatar']['h']-2
        y2=layout['reply_avatar']['y']+2
        base.paste(stripe.resize((5,y2-y1)),(93,y1))
    sheets = []
    for role in ROLES:
        part = crop(im,regions[role])
        cell=Image.new('RGB',(720, max(110,round(part.height*min(1,700/part.width))+40)),'#dedede')
        d=ImageDraw.Draw(cell)
        d.text((10,5),f'{role}: {regions[role]}',font=ImageFont.load_default(size=18),fill='black')
        part.thumbnail((700,1000),Image.Resampling.LANCZOS)
        cell.paste(part,(10,32)); sheets.append(cell)
        if role != 'media':
            p=layout[role]
            base.paste(crop(im,regions[role]).resize((p['w'],p['h']),Image.Resampling.LANCZOS),(p['x'],p['y']))
    sheet=Image.new('RGB',(720,sum(p.height for p in sheets)),'#dedede')
    y=0
    for p in sheets:
        sheet.paste(p,(0,y)); y+=p.height
    sheet.save(case/'crops.png')
    base.save(case/'base.png')
    m=layout['media']; radius=min(30,m['w']//8,m['h']//8)
    mask=Image.new('L',(m['w'],m['h']),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,m['w']-1,m['h']-1),radius,fill=255)
    mask.save(case/'mask.png')
    foreground=Image.new('RGBA',(W,H),(0,0,0,0))
    d=ImageDraw.Draw(foreground)
    d.text((m['x']+26,m['y']+m['h']-44),'@jelocare',font=ImageFont.load_default(size=25),fill='#fffaf4')
    d.text((m['x']+m['w']-110,m['y']+25),spec['trace'],font=ImageFont.load_default(size=19),fill='#fffaf4')
    foreground.save(case/'overlay.png')
    first=frame(case/'assets/media.mp4',0,(m['w'],m['h']))
    poster=base.copy(); poster.paste(first,(m['x'],m['y']),mask)
    poster=Image.alpha_composite(poster.convert('RGBA'),foreground).convert('RGB')
    poster.save(case/'preview.png')
    poster.resize((390,693),Image.Resampling.LANCZOS).save(case/'phone.png')
    dur=inp['video']['duration']; duration=round(math.ceil(6/dur)*dur,3) if dur < 6 else dur
    if preset:
        duration=preset['durationSeconds']
    plan={'schemaVersion':2,'renderer':VERSION,'inputs':inp,'regions':regions,'layout':layout,
          'durationSeconds':duration,'fps':FPS,'theme':spec['theme'],'trace':spec['trace'],
          'pairScore':pair_score,'presetId':preset['id'] if preset else None,
          'files':{f:digest(case/f) for f in ('base.png','mask.png','overlay.png','crops.png','preview.png','phone.png')}}
    dump(case/'plan.json',plan)
    dump(case/'review.template.json',{'schemaVersion':2,'planSha256':digest(case/'plan.json'),
         'checks':{key:False for key in CHECKS},'notes':'View crops.png, preview.png AND phone.png; do not approve unseen proofs.'})
    return plan


def assert_review(case, review):
    require(review.get('schemaVersion') == 2 and review.get('planSha256')==digest(case/'plan.json'),
            'STALE_REVIEW: inspect the current proofs, not an earlier plan.')
    require(all(review.get('checks',{}).get(k) is True for k in CHECKS),
            'VISUAL_REVIEW_REQUIRED: inspect every crop and phone proof, fix defects, then complete review.json.')
    plan=read(case/'plan.json'); check_assets(case)
    require(plan['inputs']==read(case/'input.json'), 'PLAN_INPUT_CHANGED')
    require(all(digest(case/f)==h for f,h in plan['files'].items()), 'PROOF_CHANGED: regenerate preview and review.')
    return plan


def pcm(path, duration):
    data=run(['-i',path,'-t',duration,'-map','0:a:0','-ac','1','-ar','8000','-f','f32le','-'])
    return np.frombuffer(data,dtype='<f4')


def verify(case, output, plan):
    source=case/'assets/media.mp4'; meta=plan['inputs']['video']; m=plan['layout']['media']
    times=sample_times(meta)
    src=[np.asarray(frame(source,t,(96,96)),dtype=float) for t in times]
    outs=[np.asarray(frame(output,t),dtype=np.int16) for t in times]
    motion=max(float(np.abs(a-src[0]).mean()) for a in src)
    require(motion > .5,'NO_SOURCE_MOTION: this is not a moving source; do not label a still a Zapshot.')
    outside=np.ones((H,W),dtype=bool)
    outside[m['y']:m['y']+m['h'],m['x']:m['x']+m['w']]=False
    delta=max(int(np.abs(a-outs[0])[outside].max()) for a in outs)
    require(delta<=STATIC_LIMIT,f'STATIC_BOUNDARY: {delta} > {STATIC_LIMIT}; do not relax the threshold.')
    motion_out=max(float(np.abs(a-outs[0])[~outside].mean()) for a in outs)
    require(motion_out > .5, 'NO_OUTPUT_MOTION: embedded media is frozen or invisible.')
    matches=[]
    for at,a in zip(times,outs):
        # Compare with both the requested phase and its previous 20fps tick.
        cut=Image.fromarray(a.astype('uint8')).crop((m['x'],m['y'],m['x']+m['w'],m['y']+m['h'])).resize((96,96))
        cut=np.asarray(cut,dtype=float)[10:80,10:86]
        candidates=[np.asarray(frame(source,t,(96,96)),dtype=float)[10:80,10:86]
                    for t in sorted(set((at,max(0,math.floor(at*FPS)/FPS))))]
        matches.append(min(float(np.abs(cut-b).mean()) for b in candidates))
    require(max(matches)<22, f'EMBED_MISMATCH: decoded panel differs from source: {matches}')
    outmeta=metadata(output)
    require(outmeta['width']==W and outmeta['height']==H and outmeta['audio']==meta['audio'],'OUTPUT_PROPERTIES: dimensions/audio changed.')
    audio=None
    if meta['audio']:
        # AAC may add encoder delay; scan only +/-20ms, not arbitrary shifts.
        length=min(meta['duration'],5)
        a=pcm(source,length); b=pcm(output,length)
        n=min(len(a),len(b)); a=a[:n]; b=b[:n]
        rms=float(np.sqrt(np.mean(a*a)))
        if rms>1e-5:
            scores=[]
            for lag in range(-160,161,8):
                aa,bb=(a[lag:],b[:n-lag]) if lag>=0 else (a[:n+lag],b[-lag:])
                scores.append(float(np.dot(aa,bb)/(np.linalg.norm(aa)*np.linalg.norm(bb)+1e-12)))
            require(max(scores)>.9,'AUDIO_SYNC: source/output samples do not align within 20ms.')
            audio={'sourceRms':rms,'correlationWithin20ms':max(scores)}
        else:
            require(float(np.sqrt(np.mean(b*b)))<.002,'AUDIO_CHANGED: silent source track gained sound.')
            audio={'sourceRms':rms,'silentTrackPreserved':True}
    run(['-i',output,'-f','null','-'])
    return {'sampleTimes':times,'sourceMotion':motion,'outputMotion':motion_out,
            'maxOutsideMediaDelta':delta,'fixedOutsideLimit':STATIC_LIMIT,
            'sourceFrameDifferences':matches,'sourceAudioPresent':meta['audio'],
            'outputAudioPresent':outmeta['audio'],'audioCheck':audio,'wholeFileDecodes':True}


def render(case, review_file):
    case=Path(case).resolve(); review=read(review_file); plan=assert_review(case,review)
    out=case/'output'; require(not out.exists(),'OUTPUT_EXISTS: final artifacts are immutable; use a new case.')
    out.mkdir(); m=plan['layout']['media']; duration=plan['durationSeconds']
    require(plan['renderer']==VERSION,'RENDERER_VERSION_CHANGED')
    command=['-y','-loop','1','-framerate',FPS,'-i',case/'base.png',
             '-stream_loop','-1','-i',case/'assets/media.mp4',
             '-loop','1','-framerate',FPS,'-i',case/'mask.png',
             '-loop','1','-framerate',FPS,'-i',case/'overlay.png']
    graph=(f"[1:v]setpts=PTS-STARTPTS,scale={m['w']}:{m['h']}:flags=lanczos,setsar=1,format=rgba[v];"
           f"[2:v]format=gray[mask];[v][mask]alphamerge[rounded];"
           f"[0:v][rounded]overlay=x={m['x']}:y={m['y']}:shortest=1[body];"
           '[body][3:v]overlay=0:0:shortest=1,format=yuv420p[final]')
    command+=['-filter_complex_threads','1','-filter_complex',graph,'-map','[final]']
    if plan['inputs']['video']['audio']:
        command+=['-map','1:a:0','-af','asetpts=PTS-STARTPTS','-c:a','aac','-b:a','192k']
    else:
        command+=['-an']
    command+=['-t',duration,'-r',FPS,'-c:v','libx264','-profile:v','baseline','-level','4.1',
              '-preset','medium','-qp','16','-g','1','-x264-params','aq-mode=0:mbtree=0',
              '-pix_fmt','yuv420p','-movflags','+faststart',out/'final.mp4']
    try:
        run(command)
        qa=verify(case,out/'final.mp4',plan)
    except Exception as exc:
        dump(out/'FAILED.json',{'result':'fail','error':str(exc),'deliverable':False})
        raise
    poster=frame(out/'final.mp4',0)
    poster.save(out/'poster.png'); poster.resize((390,693)).save(out/'phone.png')
    receipt={'schemaVersion':2,'renderer':VERSION,'result':'pass','state':'local-private-unpublished',
             'visualReview':review,'planSha256':digest(case/'plan.json'),'qa':qa,
             'presetId':plan['presetId'],'sha256':digest(out/'final.mp4'),
             'createdAt':datetime.now(timezone.utc).isoformat(),
             'rights':{'state':'unknown','publicUseReady':False},'publication':[],
             'limitation':'Geometry and decoded samples are checked; visual review is supplied by the inspecting agent, not semantic OCR certification.'}
    dump(out/'render-receipt.json',receipt)
    dump(out/'campaign.json',{'schemaVersion':1,'campaignId':plan['trace'],'status':'draft',
         'sourceAssets':{'screenshotSha256':plan['inputs']['screenshotSha256'],'videoSha256':plan['inputs']['videoSha256']},
         'sourceUrl':None,'replyUrl':None,'generationRoute':VERSION,'creative':'final.mp4',
         'sha256':receipt['sha256'],'channels':[],'publication':[]})
    (out/'SHA256SUMS').write_text(''.join(f'{digest(p)}  {p.name}\n' for p in sorted(out.iterdir()) if p.is_file()),encoding='utf-8')
    return receipt


def known_run(screenshot, video, case):
    inp=prepare(screenshot,video,case); case=Path(case).resolve()
    preset=exact_preset(inp)
    if preset:
        preview(case,case/'regions.json')
        review=read(case/'review.template.json')
        review['checks']={k:True for k in CHECKS}
        review['notes']='Previously inspected exact input pair and locked layout; preset replay, not unseen visual inference.'
        dump(case/'review.json',review)
        return render(case,case/'review.json')
    raise Stop('NEEDS_REGIONS: prepared case. Follow PLAYBOOK.md: inspect, select seven regions, preview, inspect proofs, review, render. No guessed layout was exported.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('doctor')
    for name in ('prepare','run'):
        p=sub.add_parser(name); p.add_argument('--screenshot',required=True);p.add_argument('--video',required=True);p.add_argument('--case',required=True)
    p=sub.add_parser('preview');p.add_argument('--case',required=True);p.add_argument('--regions',required=True)
    p=sub.add_parser('render');p.add_argument('--case',required=True);p.add_argument('--review',required=True)
    args=parser.parse_args()
    try:
        if args.command=='doctor':
            run(['-f','lavfi','-i','color=s=64x64:d=0.1','-c:v','libx264','-f','null','-'])
            result={'python':sys.version.split()[0],'ffmpeg':ffmpeg(),'h264Encode':'pass','renderer':VERSION,
                    'capabilitiesRequired':['read ZIP','view images','execute Python','return files'],'noApiKeyNeeded':True}
        elif args.command in ('prepare','run'):
            result=(prepare if args.command=='prepare' else known_run)(args.screenshot,args.video,args.case)
        elif args.command=='preview': result=preview(args.case,args.regions)
        else: result=render(args.case,args.review)
        print(json.dumps(result,indent=2));return 0
    except (Stop,OSError,ValueError,KeyError) as exc:
        print(f'STOP: {exc}',file=sys.stderr);return 2


if __name__=='__main__':
    raise SystemExit(main())
