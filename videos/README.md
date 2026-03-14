```bash
sudo apt install python3.11 python3.11-venv
python3.11 -m venv env
pip3 install -r requirements.txt
brew install imagemagick
brew install ffmpeg
```

In `moviepy/video/compositing/CompositeVideoClip.py`:
```python
    def __init__(self, clips, size=None, bg_color=None, use_bgclip=False,
                 ismask=False, override_transparent = False):

        if size is None:
            size = clips[0].size

        
        if use_bgclip and (clips[0].mask is None):
            transparent = False or override_transparent
        else:
            transparent = (bg_color is None) or override_transparent
        
        if bg_color is None:
            bg_color = 0.0 if ismask else (0, 0, 0)
```