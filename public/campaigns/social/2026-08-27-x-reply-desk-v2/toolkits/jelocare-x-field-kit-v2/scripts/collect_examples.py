#!/usr/bin/env python3
"""Package only known fictional fixture renders as worked before/after examples."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path
import imageio_ffmpeg


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('test_directory',type=Path)
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    target=root/'examples/visual'
    for name in ('dark-square','light-landscape','dark-portrait'):
        expected=json.loads((target/name/'metadata.json').read_text())
        case=args.test_directory/name
        actual=json.loads((case/'input.json').read_text())
        assert expected['synthetic'] is True
        assert actual['originalScreenshotSha256']==expected['screenshotSha256']
        assert actual['videoSha256']==expected['videoSha256']
        receipt=json.loads((case/'output/render-receipt.json').read_text())
        assert receipt['result']=='pass'
        # Keep one complete original media cycle in the portable demonstration,
        # stream-copying the already-checked 1080p frames and audio (no re-encode).
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y',
                        '-i',str(case/'output/final.mp4'),'-t','2','-map','0','-c','copy',
                        '-movflags','+faststart',str(target/name/'after.mp4')],check=True)
        for source,dest in [('output/poster.png','after.png'),
                            ('output/phone.png','phone.png'),('crops.png','crops.png')]:
            shutil.copyfile(case/source,target/name/dest)
        (target/name/'after-qa.json').write_text(json.dumps({'synthetic':True,'qa':receipt['qa'],
                'fullRenderSha256':receipt['sha256'],'afterSha256':sha(target/name/'after.mp4'),
                'afterDurationSeconds':2,'afterIsStreamCopiedOneCycleExcerpt':True,
                'visualReview':'Root inspected full and phone proofs; complete fictional identities and sentinel words.'},indent=2)+'\n')
    assets=[]
    for path in sorted(target.rglob('*')):
        if path.suffix.lower() in {'.mp4','.png','.jpg','.gif','.mp3','.wav'}:
            assets.append({'path':path.relative_to(root).as_posix(),'sha256':sha(path),
                           'provenance':'Original fictional code-native fixture or its deterministic derivative; not third-party media.'})
    (target/'ASSETS.json').write_text(json.dumps({'schemaVersion':1,'synthetic':True,'assets':assets},indent=2)+'\n')
    print(f'Collected {len(assets)} original fixture media assets.')


if __name__=='__main__':
    main()
