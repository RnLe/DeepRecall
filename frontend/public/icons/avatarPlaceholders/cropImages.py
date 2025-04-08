# This script crops transparent borders from PNG images in the current directory.
# WARNING: This will overwrite the original images.
# WARNING: If padding is smaller than 0, the final cropped image will be smaller than the original image.

from PIL import Image
import os

def crop_transparent_borders(image_path, padding=-5, alpha_threshold=10):
    """
    Crop the image by removing transparent borders (with alpha thresholding)
    and apply extra padding.
    
    Parameters:
        image_path (str): The path to the image.
        padding (int): Positive expands the crop region, negative shrinks it.
        alpha_threshold (int): Alpha values below this are treated as transparent.
    """
    img = Image.open(image_path)

    # Ensure image is in RGBA mode
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    
    # Extract the alpha channel and apply thresholding:
    # Pixels with alpha values below alpha_threshold become 0 (transparent), others stay unchanged.
    alpha = img.split()[-1]
    # Using point transformation to apply the threshold to the alpha channel.
    alpha = alpha.point(lambda a: a if a >= alpha_threshold else 0)

    # Get the bounding box from the thresholded alpha channel
    bbox = alpha.getbbox()

    if bbox:
        left, upper, right, lower = bbox

        # Apply padding: positive expands, negative shrinks.
        new_left   = max(left - padding, 0)
        new_upper  = max(upper - padding, 0)
        new_right  = min(right + padding, img.width)
        new_lower  = min(lower + padding, img.height)

        # Validation: ensure the bounding box remains valid.
        if new_right <= new_left or new_lower <= new_upper:
            print(f"Warning: Negative padding is too large for {image_path}. Skipping crop.")
            return

        cropped = img.crop((new_left, new_upper, new_right, new_lower))
        cropped.save(image_path)
        print(f"Cropped and saved: {image_path}")
    else:
        print(f"Skipped (fully transparent): {image_path}")

def main():
    # Get current folder (non-recursive)
    folder_path = os.getcwd()
    # Set the desired padding (negative value to shrink the area)
    padding = 0
    # Set your alpha threshold (tweak this value as needed)
    alpha_threshold = 10

    for filename in os.listdir(folder_path):
        if filename.lower().endswith(".png"):
            full_path = os.path.join(folder_path, filename)
            try:
                crop_transparent_borders(full_path, padding=padding, alpha_threshold=alpha_threshold)
            except Exception as e:
                print(f"Failed to process {filename}: {e}")

if __name__ == "__main__":
    main()
