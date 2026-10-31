/* contact.js – form validation for the contact form and the newsletter form (Level 4) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function setError(field, message) {
  const wrap = field.closest('.field'); if (!wrap) return;
  wrap.classList.toggle('invalid', !!message);
  $('.err', wrap).textContent = message || '';
  field.setAttribute('aria-invalid', !!message);
}

function validate(form) {
  const rules = {
    name: v => v.trim().length < 2 ? 'Enter your name (at least 2 characters).' : '',
    email: v => !EMAIL_RE.test(v.trim()) ? 'Enter a valid email, like name@example.com.' : '',
    message: v => v.trim().length < 10 ? 'Write a message of at least 10 characters.' : ''
  };
  let ok = true;
  Object.keys(rules).forEach(name => {
    const field = form.elements[name]; if (!field) return;
    const msg = rules[name](field.value); setError(field, msg); if (msg) ok = false;
  });
  return ok;
}

document.addEventListener('DOMContentLoaded', () => {
  $$('form[data-validate]').forEach(form => {
    const status = $('.form-status', form.parentElement);
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!validate(form)) { status.className = 'form-status bad'; status.textContent = 'Please fix the highlighted fields.'; return; }
      status.className = 'form-status ok';
      status.textContent = form.dataset.validate === 'contact'
        ? 'Thanks! Your message is ready. (Demo site: no server, so nothing was actually sent.)'
        : 'You are on the list. (Demo site: no email was saved.)';
      form.reset();
    });
    form.addEventListener('input', e => { if (e.target.closest('.field')) setError(e.target, ''); });
  });
});
