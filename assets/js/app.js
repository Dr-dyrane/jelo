import { header, hero, profile, filters, productCard, ritual, suppliers, footer, dialogContent } from "./components.js";
import { save, load } from "./storage.js";

const $ = (selector) => document.querySelector(selector);

async function loadProducts() {
  const response = await fetch("./assets/data/products.json");
  if (!response.ok) throw new Error("Unable to load product inventory.");
  return response.json();
}

function renderLedger(products) {
  $("#ledger").innerHTML = `
    <div class="section-head"><h2>The<br>Ledger</h2><p>Opening dates, remaining quantity and reorder timing.</p></div>
    <div class="ledger-shell">
      <table>
        <thead><tr><th>Product</th><th>Opened</th><th>Remaining</th><th>Reorder</th><th>Paid</th><th>Due</th></tr></thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>${p.brand} · ${p.name}</td>
              <td><input type="date" data-key="${p.id}:opened"></td>
              <td><input placeholder="40%" data-key="${p.id}:remaining"></td>
              <td><input type="date" data-key="${p.id}:reorder"></td>
              <td><input placeholder="₦" data-key="${p.id}:paid"></td>
              <td><input class="check" type="checkbox" data-key="${p.id}:due"></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  document.querySelectorAll("[data-key]").forEach(input => {
    const key = input.dataset.key;
    const stored = load(key, input.type === "checkbox" ? false : "");
    if (input.type === "checkbox") input.checked = Boolean(stored);
    else input.value = stored;
    input.addEventListener("input", () => save(key, input.type === "checkbox" ? input.checked : input.value));
  });
}

function bindFilters(products) {
  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-filter]").forEach(x => x.classList.remove("active"));
      button.classList.add("active");
      const filter = button.dataset.filter;
      const visible = products.filter(p =>
        filter === "All" ||
        p.category === filter ||
        (filter === "Essential" && ["Essential", "Never skip"].includes(p.priority))
      );
      $("#product-grid").innerHTML = visible.map(productCard).join("");
      bindProductButtons(products);
    });
  });
}

function bindRoutineTabs() {
  document.querySelectorAll("[data-routine]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-routine]").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".routine").forEach(x => x.classList.remove("active"));
      button.classList.add("active");
      $(`#routine-${button.dataset.routine}`).classList.add("active");
    });
  });
}

function bindProductButtons(products) {
  document.querySelectorAll("[data-product-id]").forEach(button => {
    button.addEventListener("click", () => {
      const product = products.find(p => p.id === button.dataset.productId);
      const dialog = $("#product-dialog");
      dialog.innerHTML = dialogContent(product);
      dialog.showModal();
      dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    });
  });
}

async function init() {
  try {
    const products = await loadProducts();

    $("#site-header").innerHTML = header();
    $("#hero").innerHTML = hero(products.length);
    $("#profile").innerHTML = profile();
    $("#collection").classList.add("collection");
    $("#collection").innerHTML = `
      <div class="section-head"><h2>The<br>Collection</h2><p>Every product has earned its place.</p></div>
      ${filters()}
      <div class="product-grid" id="product-grid">${products.map(productCard).join("")}</div>`;
    $("#ritual").innerHTML = ritual();
    $("#suppliers").innerHTML = suppliers();
    renderLedger(products);
    $("#site-footer").innerHTML = footer();

    $("#print-site").addEventListener("click", () => window.print());
    bindFilters(products);
    bindRoutineTabs();
    bindProductButtons(products);
  } catch (error) {
    document.body.innerHTML = `<main style="padding:40px;font-family:system-ui"><h1>Jelo Personal Care</h1><p>${error.message}</p></main>`;
  }
}

init();