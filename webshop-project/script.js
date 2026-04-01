async function loadProducts() {
  const res = await fetch('https://fakestoreapi.com/products');
  const products = await res.json();

  const container = document.getElementById('products');

  products.forEach(p => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>${p.title}</h3>
      <p>€${p.price}</p>
      <button onclick="addToCart('${p.title}')">Add to cart</button>
    `;
    container.appendChild(div);
  });
}

loadProducts();


let cart = [];

function addToCart(product) {
  cart.push(product);
  renderCart();
}

function renderCart() {
  const cartDiv = document.getElementById('cart');
  cartDiv.innerHTML = "<h2>Cart:</h2>" + cart.join("<br>");
}