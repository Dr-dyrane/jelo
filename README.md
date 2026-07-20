# Jelo Personal Care

A modular static website for Jelo’s personal-care inventory, routines and supplier hierarchy.

## Structure

```text
index.html
assets/
  css/
    styles.css
  data/
    products.json
  js/
    app.js
    components.js
    storage.js
```

## Local preview

Because the site loads `products.json` with `fetch`, preview it through a small local server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

1. Create a GitHub repository.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`.
6. Save.

No build command or framework is required.

## Updating products

Edit `assets/data/products.json`.

Each product supplies:

- name and brand
- category and routine step
- image URL
- concise display text
- primary and secondary retailer links
- inventory priority

The interface renders automatically from the data file.

## Notes

- Inventory ledger values are saved in the browser with `localStorage`.
- External retailer images and links require internet access.
- The project is compatible with GitHub Pages and other static hosts.
