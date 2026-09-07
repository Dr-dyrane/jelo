#!/usr/bin/env python3
"""Focused v2 fixture renders and negative gates. No human/AI portability claim."""
import argparse
import copy
import tempfile
from pathlib import Path

import zapshot as z


def rejected(action, label):
    try:
        action()
    except (z.Stop, ValueError, OSError):
        return label
    raise AssertionError('UNSAFE_ACCEPT: '+label)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args=parser.parse_args()
    root=args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix='zapshot-v2-check-'))
    root.mkdir(parents=True,exist_ok=True)
    examples=z.ROOT/'examples/visual'
    results=[]; negative=[]
    for name in ('dark-square','light-landscape','dark-portrait'):
        source=examples/name; case=root/name
        inp=z.prepare(source/'screenshot.png',source/'media.mp4',case)
        regions=z.read(source/'regions.json')
        plan=z.preview(case,source/'regions.json')
        review=z.read(case/'review.template.json')
        negative.append(rejected(lambda:z.assert_review(case,review),name+' incomplete visual attestation'))
        bad=copy.deepcopy(regions);bad['regions']['source_text'][2]=90000
        negative.append(rejected(lambda:z.normalize_regions(bad,inp),name+' out-of-source crop'))
        bad=copy.deepcopy(regions);bad['regions']['source_text']=bad['regions']['media']
        negative.append(rejected(lambda:z.normalize_regions(bad,inp),name+' overlapping old media'))
        bad=copy.deepcopy(regions);bad['videoSha256']='0'*64
        negative.append(rejected(lambda:z.normalize_regions(bad,inp),name+' wrong source hash'))
        bad=copy.deepcopy(regions);bad['coordinateSpace']['height']+=500
        negative.append(rejected(lambda:z.normalize_regions(bad,inp),name+' mixed coordinate aspect'))
        image=z.Image.open(case/'assets/screenshot.png').convert('RGB')
        bad=copy.deepcopy(plan['regions'])
        x,y,w,h=bad['source_avatar'];bad['source_avatar']=[x+w//4,y+h//4,w//2,h//2]
        negative.append(rejected(lambda:z.check_crop_edges(image,bad,regions['theme']),name+' clipped avatar foreground'))
        bad=copy.deepcopy(plan['regions'])
        x,y,w,h=bad['source_text']
        pixels=z.np.asarray(z.crop(image,bad['source_text']),dtype=float)
        foreground=z.np.max(z.np.abs(pixels-(0 if regions['theme']=='dark' else 255)),axis=2)>60
        cut=int(foreground.sum(axis=1).argmax())+1
        bad['source_text']=[x,y,w,cut]
        negative.append(rejected(lambda:z.check_crop_edges(image,bad,regions['theme']),name+' clipped text foreground'))
        # Exact fixture truth is program-generated. These true fields are not an
        # assertion that an AI viewed the proofs; independent visual review is separate.
        review['checks']={key:True for key in z.CHECKS}
        review['notes']='Synthetic fixture geometry ground truth for automated regression, not a model visual-review claim.'
        z.dump(case/'review.json',review)
        stale=copy.deepcopy(review);stale['planSha256']='0'*64
        negative.append(rejected(lambda:z.assert_review(case,stale),name+' stale review hash'))
        result=z.render(case,case/'review.json')
        results.append({'case':name,'result':result['result'],'sha256':result['sha256'],'qa':result['qa']})
        if inp['video']['audio']:
            z.run(['-y','-i',case/'output/final.mp4','-c:v','copy','-an',case/'missing-audio.mp4'])
            negative.append(rejected(lambda:z.verify(case,case/'missing-audio.mp4',plan),name+' discarded source audio'))
    # Same bytes, second clean case => bitwise idempotence within this locked runtime.
    source=examples/'dark-square';case=root/'repeat-square'
    z.prepare(source/'screenshot.png',source/'media.mp4',case)
    z.preview(case,source/'regions.json')
    review=z.read(case/'review.template.json');review['checks']={k:True for k in z.CHECKS}
    review['notes']='Program-generated fixture regression; not independent vision certification.'
    z.dump(case/'review.json',review)
    repeat=z.render(case,case/'review.json')
    assert repeat['sha256']==results[0]['sha256'], 'SAME_RUNTIME_NONDETERMINISTIC'
    wrong=Path(root/'wrong-pair')
    z.prepare(examples/'dark-square/screenshot.png',examples/'light-landscape/media.mp4',wrong)
    spec=z.read(examples/'dark-square/regions.json');spec['videoSha256']=z.digest(wrong/'assets/media.mp4')
    z.dump(wrong/'regions.json',spec)
    negative.append(rejected(lambda:z.preview(wrong,wrong/'regions.json'),'different video with updated hash'))
    summary={'renderer':z.VERSION,'result':'pass','fixtures':results,'negativeGates':negative,
             'sameRuntimeByteIdentity':True,'independentModelTrial':'not included in self-test'}
    z.dump(root/'SELF-TEST.json',summary)
    print(f"PASS: {len(results)} fixture renders; {len(negative)} rejection checks; repeat bytes match. {root/'SELF-TEST.json'}")


if __name__=='__main__':
    main()
