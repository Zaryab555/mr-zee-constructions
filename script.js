const menu = document.querySelector('.menu');
const links = document.querySelector('.links');

if (menu && links) {
  menu.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  document.querySelectorAll('.links a').forEach((a) => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
    });
  });
}

const year = document.getElementById('year');

if (year) {
  year.textContent = new Date().getFullYear();
}

const range = document.getElementById('compareRange');
const before = document.getElementById('beforeWrap');
const divider = document.getElementById('divider');

function setCompare(value) {
  before.style.width = value + '%';
  divider.style.left = value + '%';
}

if (range) {
  range.addEventListener('input', (event) => {
    setCompare(event.target.value);
  });

  setCompare(range.value);
}

const form = document.getElementById('quickQuote');

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = document.getElementById('name').value.trim();
    const postcode = document.getElementById('postcode').value.trim();
    const service = document.getElementById('service').value;
    const details = document.getElementById('details').value.trim();

    const text = `Hello Mr. Zee Constructions,

I would like a free quotation.

Name: ${name}
Postcode: ${postcode}
Service: ${service}

Job details:
${details}

I can send photos here.`;

    window.open(
      'https://wa.me/447756618980?text=' + encodeURIComponent(text),
      '_blank'
    );
  });
}
