
// -------------------------------
// CART
// -------------------------------
let cart = [];

// LOAD PRODUCTS FROM BACKEND

async function loadProducts() {
  const res = await fetch('http://127.0.0.1:5000/products');
  const products = await res.json();

  const container = document.getElementById('products');
  container.innerHTML = ""; // clear voor safety

  products.forEach(p => {
    const div = document.createElement('div');

    div.innerHTML = `
      <p><strong>${p.name}</strong> - €${p.price}</p>
      <button onclick='addToCart(${JSON.stringify(p)})'>Add</button>
      <hr>
    `;

    container.appendChild(div);
  });
}

// ADD TO CART

function addToCart(product) {
  cart.push(product);
  renderCart();
}

// RENDER CART

function renderCart() {
  const cartDiv = document.getElementById('cart');
  cartDiv.innerHTML = "";

  cart.forEach((item, index) => {
    const div = document.createElement('div');

    div.innerHTML = `
      ${item.name} - €${item.price}
      <button onclick="removeFromCart(${index})">Remove</button>
      <br>
    `;

    cartDiv.appendChild(div);
  });
}

// REMOVE FROM CART

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

// LOGIN

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  const res = await fetch('http://127.0.0.1:5000/login', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  alert(JSON.stringify(data));
}

// CHECKOUT

async function checkout() {
  const res = await fetch('http://127.0.0.1:5000/order', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cart })
  });

  const data = await res.json();
  alert("Order placed!");
}


loadProducts();

