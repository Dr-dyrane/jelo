export const header = () => `
  <nav class="site-nav">
    <a class="logo" href="#hero">JELO</a>
    <div class="nav-actions">
      <a class="pill" href="#collection">Collection</a>
      <a class="pill" href="#ritual">Ritual</a>
      <a class="pill" href="#suppliers">Stores</a>
      <button class="pill" id="print-site">Print</button>
    </div>
  </nav>`;

export const hero = (count) => `
  <div class="hero">
    <div class="hero-copy">
      <span class="eyebrow">Personal care · private edition</span>
      <h1 class="display">JELO<br>CARE</h1>
      <p>Everything she owns. Everything she needs. Nothing she does not.</p>
    </div>
    <div class="hero-image">
      <img src="https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=1800&q=92" alt="">
      <div class="hero-count"><b>${count}</b><span>curated products</span></div>
    </div>
  </div>`;

export const profile = () => `
  <div class="section-head">
    <h2>Her<br>Skin</h2>
    <p>Oil control. Clearer pores. Even tone. A protected barrier.</p>
  </div>
  <div class="profile-grid">
    ${[
      ["Skin type","Oily"],["Reactivity","Sensitive"],["Breakouts","Acne-prone"],
      ["Congestion","Blackheads"],["Tone","PIH"],["Texture","Visible pores"]
    ].map(([label,value]) => `<article class="profile-item"><span>${label}</span><b>${value}</b></article>`).join("")}
  </div>`;

export const filters = () => `
  <div class="toolbar">
    ${["All","Face","Body","Hair","Essential"].map((x,i)=>`<button class="filter ${i===0?"active":""}" data-filter="${x}">${x}</button>`).join("")}
  </div>`;

export const productCard = (product) => `
  <article class="product-card">
    <div class="product-image">
      <span class="product-step">${product.category} · ${product.step}</span>
      <img src="${product.image}" alt="${product.brand} ${product.name}" loading="lazy">
    </div>
    <div class="product-copy">
      <span class="brand">${product.brand}</span>
      <h3>${product.name}</h3>
      <span class="product-size">${product.size}</span>
      <p class="product-purpose">${product.purpose}</p>
      <div class="product-actions">
        <a class="buy" href="${product.primary.url}" target="_blank" rel="noopener">${product.primary.label}</a>
        <button class="details" data-product-id="${product.id}" aria-label="View ${product.name}">＋</button>
      </div>
    </div>
  </article>`;

export const ritual = () => `
  <div class="section-head"><h2>The<br>Ritual</h2><p>Simple. Consistent. Deliberate.</p></div>
  <div class="ritual-grid">
    <div class="ritual-panel">
      <span class="eyebrow">Daily protocol</span>
      <div class="tabs">
        <button class="filter active" data-routine="am">Morning</button>
        <button class="filter" data-routine="pm">Evening</button>
        <button class="filter" data-routine="hair">Hair wash</button>
      </div>
      <div class="routine active" id="routine-am">
        ${step("01","COSRX cleanser","Brief, gentle cleanse.")}
        ${step("02","Anua serum","Thin, even layer.")}
        ${step("03","Wonder Cream","Light hydration.")}
        ${step("04","B.LAB sunscreen","Final morning step.")}
      </div>
      <div class="routine" id="routine-pm">
        ${step("01","Cleanse","Remove sunscreen and buildup.")}
        ${step("02","Treat","Anua most nights. Toner twice weekly.")}
        ${step("03","Moisturize","Bright + Clear or Wonder Cream.")}
      </div>
      <div class="routine" id="routine-hair">
        ${step("01","Miracle shampoo","Cleanse the scalp.")}
        ${step("02","Lush conditioner","Condition and rinse.")}
        ${step("03","Mediana milk","Leave-in moisture.")}
        ${step("04","Kuza + OGX","Treat, then finish.")}
      </div>
    </div>
    <div class="ritual-photo"><strong>Calm skin first.<br>Correction second.</strong></div>
  </div>`;

function step(no,title,copy){
  return `<div class="routine-step"><b>${no}</b><div><h3>${title}</h3><p>${copy}</p></div></div>`;
}

export const suppliers = () => {
  const list = [
    ["01","Beauty by Daz","Primary"],
    ["02","Care to Beauty","Secondary"],
    ["03","Perona Beauty","Third"],
    ["04","Shop Station","Fourth"],
    ["05","Jumia","Last resort"]
  ];
  return `
    <div class="section-head"><h2>The<br>Supply Line</h2><p>Beauty by Daz first. Jumia only when every preferred source fails.</p></div>
    <div class="supplier-grid">
      ${list.map(([rank,name,note])=>`<article class="supplier"><span class="supplier-rank">${rank}</span><div><h3>${name}</h3><p>${note}</p></div></article>`).join("")}
    </div>`;
};

export const footer = () => `
  <div class="site-footer"><span>Jelo Personal Care</span><span>Screen · mobile · print</span></div>`;

export const dialogContent = (product) => `
  <div class="dialog-grid">
    <img src="${product.image}" alt="${product.name}">
    <div class="dialog-copy">
      <button class="dialog-close" aria-label="Close">×</button>
      <span class="eyebrow">${product.brand} · ${product.category}</span>
      <h2>${product.name}</h2>
      <p>${product.size}</p>
      <p>${product.usage}</p>
      <div class="dialog-links">
        <a class="buy" href="${product.primary.url}" target="_blank" rel="noopener">${product.primary.label}</a>
        <a class="pill" href="${product.secondary.url}" target="_blank" rel="noopener">${product.secondary.label}</a>
      </div>
    </div>
  </div>`;