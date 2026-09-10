import sys

def rewrite():
    with open('public/index.html', 'r') as f:
        html = f.read()

    # We will just replace the entire content of index.html for a cleaner rewrite
    # But wait, we can just write the whole index.html out in python.
    # Same for CSS and JS.
    pass

if __name__ == "__main__":
    rewrite()
