const menuBtn = document.querySelector('.menu-btn');
const nav = document.querySelector('.nav-links');

if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    nav.classList.toggle('open');
  });

  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
    });
  });
}

const year = document.getElementById('year');
if (year) {
  year.textContent = new Date().getFullYear();
}

const form = document.getElementById('whatsappForm');

if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('customerName').value;
    const phone = document.getElementById('customerPhone').value;
    const postcode = document.getElementById('customerPostcode').value;
    const service = document.getElementById('customerService').value;
    const details = document.getElementById('jobDetails').value;

    const message =
`Hello Mr. Zee Constructions,

I would like a free quotation.

Name: ${name}
Phone: ${phone}
Postcode: ${postcode}
Service: ${service}

Job Details:
${details}`;

    window.open(
      "https://wa.me/447756618980?text=" + encodeURIComponent(message),
      "_blank"
    );
  });
}
