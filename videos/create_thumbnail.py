from PIL import Image
from client import data_path, LATEST_LEVEL_RANGE, path_in_last_dir


def create_thumbnail(l, r):
    image1 = Image.open(path_in_last_dir("../thumbnail.png")).convert("RGBA")
    image2 = Image.open(data_path(f"levels/{LATEST_LEVEL_RANGE}.png")).convert(
        "RGBA"
    )
    image3 = Image.open(data_path(f"{l}/{l}_{r}_intro_overlay.png")).convert(
        "RGBA"
    )
    assert image1.size == image2.size
    assert image1.size == image3.size
    composite = Image.new("RGBA", image1.size)
    composite.paste(image1, (0, 0), image1)
    composite.paste(image2, (0, 0), image2)
    composite.paste(image3, (0, 0), image3)
    composite.save(path_in_last_dir(f"{l}_{r}/thumbnail.png"))


# create_thumbnail('ru', 'de')
