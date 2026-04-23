let cart = [];
let allProducts = [];
let carouselOffset = 0;
const VISIBLE_CARDS = 3;

const PRODUCT_ICONS = ['👟', '👕', '🧢', '🩴', '🧥', '🎽'];

async function loadProducts() {
  const res = await fetch('http://127.0.0.1:5000/products');
  allProducts = await res.json();
  renderProducts(allProducts);
}

function renderProducts(products) {
  const container = document.getElementById('products');
  container.innerHTML = '';

  if (products.length === 0) {
    container.innerHTML = '<p class="no-results">Geen producten gevonden.</p>';
    return;
  }

  products.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    const imgContent = p.image
      ? `<img src="${p.image}" alt="${p.name}" class="product-img-photo" />`
      : `<span class="product-img-emoji">${PRODUCT_ICONS[i % PRODUCT_ICONS.length]}</span>`;
    card.innerHTML = `
      <div class="product-img">
        ${imgContent}
        <span class="product-name-pill">${p.name}</span>
      </div>
      <div class="product-card-footer">
        <span class="product-price">€${p.price}</span>
        <button class="add-to-cart-btn" onclick='addToCart(${JSON.stringify(p)})'>Add to bag</button>
      </div>
    `;
    container.appendChild(card);
  });

  updateCarouselArrows();
}

function filterProducts() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(query));
  carouselOffset = 0;
  renderProducts(filtered);
  if (query) {
    document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
  }
}

function carouselPrev() {
  if (carouselOffset > 0) {
    carouselOffset--;
    updateCarousel();
  }
}

function carouselNext() {
  const total = document.getElementById('products').children.length;
  if (carouselOffset < total - VISIBLE_CARDS) {
    carouselOffset++;
    updateCarousel();
  }
}

function updateCarousel() {
  const track = document.getElementById('products');
  const card = track.children[0];
  if (!card) return;
  const cardWidth = card.offsetWidth + 12;
  track.style.transform = `translateX(-${carouselOffset * cardWidth}px)`;
  updateCarouselArrows();
}

function updateCarouselArrows() {
  const total = document.getElementById('products').children.length;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = carouselOffset === 0;
  if (next) next.disabled = carouselOffset >= total - VISIBLE_CARDS;
}

function addToCart(product) {
  cart.push(product);
  renderCart();
  updateCartCount();
  openCart();
}

function renderCart() {
  const cartDiv = document.getElementById('cart');
  const totalEl = document.getElementById('cart-total');

  if (cart.length === 0) {
    cartDiv.innerHTML = '<p class="cart-empty">Je bag is leeg.</p>';
    if (totalEl) totalEl.textContent = '€0';
    return;
  }

  cartDiv.innerHTML = '';
  let total = 0;

  cart.forEach((item, index) => {
    total += item.price;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-img">${PRODUCT_ICONS[index % PRODUCT_ICONS.length]}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">€${item.price}</div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${index})">✕</button>
    `;
    cartDiv.appendChild(div);
  });

  if (totalEl) totalEl.textContent = `€${total}`;
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
  updateCartCount();
}

function updateCartCount() {
  const count = document.getElementById('cart-count');
  if (count) count.textContent = cart.length;
}

function toggleCart() {
  document.getElementById('cart-sidebar').classList.toggle('active');
  document.getElementById('cart-overlay').classList.toggle('active');
}

function openCart() {
  document.getElementById('cart-sidebar').classList.add('active');
  document.getElementById('cart-overlay').classList.add('active');
}

function openLogin() {
  document.getElementById('login-modal').classList.add('active');
  document.getElementById('login-overlay').classList.add('active');
}

function closeLogin() {
  document.getElementById('login-modal').classList.remove('active');
  document.getElementById('login-overlay').classList.remove('active');
}

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const res = await fetch('http://127.0.0.1:5000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (data.message === 'login success') {
    closeLogin();
    alert('Welkom terug!');
  } else {
    alert('Ongeldige inloggegevens.');
  }
}

async function checkout() {
  if (cart.length === 0) {
    alert('Je bag is leeg!');
    return;
  }

  const res = await fetch('http://127.0.0.1:5000/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart })
  });

  await res.json();
  cart = [];
  renderCart();
  updateCartCount();
  toggleCart();
  alert('Bestelling geplaatst! Bedankt voor je aankoop.');
}

loadProducts();
