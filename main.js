// =========================================
// Crown Consulting Team - Main JavaScript
// =========================================

// State
let isLoading = false;
let lastQuestion = '';
let lastFocusedElement = null;
let placeholderInterval = null;

// Placeholder cycling
const placeholderExamples = [
  "I need help with payroll...",
  "I need to understand federal FAR rules...",
  "I need an IIPP...",
  "I need to hire a crane operator...",
  "I want to bid on a PG&E contract...",
  "I need help getting DBE certified...",
  "I need to update my employee handbook...",
  "I need help with union negotiations..."
];
let placeholderIndex = 0;

// DOM Elements - Hero Input (may not exist on subpages)
const chatInput = document.getElementById('chatInput');
const chatSubmit = document.getElementById('chatSubmit');
const ctaInput = document.getElementById('ctaInput');
const ctaSubmit = document.getElementById('ctaSubmit');

// DOM Elements - Page Search Input (subpages only)
const pageSearchInput = document.getElementById('pageSearchInput');
const pageSearchSubmit = document.getElementById('pageSearchSubmit');

// DOM Elements - Report Modal
const reportModal = document.getElementById('reportModal');
const reportClose = document.getElementById('reportClose');
const reportLoading = document.getElementById('reportLoading');
const reportResult = document.getElementById('reportResult');
const reportIssue = document.getElementById('reportIssue');
const reportRecommendation = document.getElementById('reportRecommendation');
const reportCta = document.getElementById('reportCta');

// DOM Elements - Form Modal
const formModal = document.getElementById('formModal');
const formClose = document.getElementById('formClose');
const consultationForm = document.getElementById('consultationForm');
const formSuccess = document.getElementById('formSuccess');
const ctaButton = document.getElementById('ctaButton');

// =========================================
// Focus Trap Utility
// =========================================

function getFocusableElements(container) {
  return container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
}

function trapFocus(e, container) {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
}

function getScrollbarWidth() {
  return window.innerWidth - document.documentElement.clientWidth;
}

// =========================================
// Report Modal Functions
// =========================================

function openReportModal() {
  lastFocusedElement = document.activeElement;

  // Prevent layout shift from scrollbar
  const scrollbarWidth = getScrollbarWidth();
  document.documentElement.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
  document.body.classList.add('modal-open');

  reportModal.classList.add('active');

  // Show loading, hide result
  reportLoading.classList.remove('hidden');
  reportResult.classList.remove('show');

  // Focus close button after animation
  setTimeout(() => {
    if (reportClose) reportClose.focus();
  }, 100);
}

function closeReportModal() {
  reportModal.classList.remove('active');
  document.body.classList.remove('modal-open');
  document.documentElement.style.setProperty('--scrollbar-width', '0px');

  // Restore focus
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

function showReportResult(issue, recommendation) {
  reportIssue.textContent = issue;
  reportRecommendation.innerHTML = formatMessage(recommendation);
  reportLoading.classList.add('hidden');
  reportResult.classList.add('show');
}

function formatMessage(content) {
  // Convert URLs to links
  let formatted = content.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener">$1</a>'
  );

  // Convert **bold** to <strong>
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Convert newlines to paragraphs
  const paragraphs = formatted.split('\n\n');
  if (paragraphs.length > 1) {
    formatted = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
  } else {
    formatted = `<p>${formatted}</p>`;
  }

  return formatted;
}

async function submitQuestion(question) {
  if (!question.trim() || isLoading) return;

  isLoading = true;
  lastQuestion = question.trim();
  openReportModal();

  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: question }]
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    showReportResult(question, data.message);

  } catch (error) {
    console.error('Error:', error);
    showReportResult(question, "We're having trouble connecting right now. Please try again, or book a free consultation directly to discuss your needs with our team.");
  } finally {
    isLoading = false;
  }
}

// =========================================
// Form Modal Functions
// =========================================

function openFormModal(prefillMessage = '') {
  lastFocusedElement = document.activeElement;

  // Prevent layout shift from scrollbar
  const scrollbarWidth = getScrollbarWidth();
  document.documentElement.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
  document.body.classList.add('modal-open');

  formModal.classList.add('active');

  // Reset form state
  consultationForm.classList.remove('hidden');
  formSuccess.classList.remove('show');
  consultationForm.reset();
  clearFormErrors();

  // Prefill message if provided
  if (prefillMessage) {
    const messageField = document.getElementById('message');
    if (messageField) {
      messageField.value = prefillMessage;
    }
  }

  // Focus first input after animation
  setTimeout(() => {
    const nameField = document.getElementById('name');
    if (nameField) nameField.focus();
  }, 100);
}

function closeFormModal() {
  formModal.classList.remove('active');
  document.body.classList.remove('modal-open');
  document.documentElement.style.setProperty('--scrollbar-width', '0px');

  // Restore focus
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

// =========================================
// Form Validation
// =========================================

function showFieldError(field, message) {
  const formGroup = field.closest('.form-group');
  if (!formGroup) return;

  field.setAttribute('aria-invalid', 'true');

  let errorEl = formGroup.querySelector('.field-error');
  if (!errorEl) {
    errorEl = document.createElement('span');
    errorEl.className = 'field-error';
    errorEl.setAttribute('role', 'alert');
    formGroup.appendChild(errorEl);
  }
  errorEl.textContent = message;
  field.setAttribute('aria-describedby', errorEl.id || '');
}

function clearFieldError(field) {
  const formGroup = field.closest('.form-group');
  if (!formGroup) return;

  field.removeAttribute('aria-invalid');
  field.removeAttribute('aria-describedby');

  const errorEl = formGroup.querySelector('.field-error');
  if (errorEl) errorEl.remove();
}

function clearFormErrors() {
  if (!consultationForm) return;
  const fields = consultationForm.querySelectorAll('input, textarea');
  fields.forEach(clearFieldError);
}

// =========================================
// Event Listeners - Hero Input (homepage only)
// =========================================

if (chatInput && chatSubmit) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
      const question = chatInput.value.trim();
      chatInput.value = '';
      submitQuestion(question);
    }
  });

  chatSubmit.addEventListener('click', () => {
    if (chatInput.value.trim()) {
      const question = chatInput.value.trim();
      chatInput.value = '';
      submitQuestion(question);
    }
  });
}

// =========================================
// Event Listeners - CTA Input
// =========================================

if (ctaInput && ctaSubmit) {
  ctaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && ctaInput.value.trim()) {
      const question = ctaInput.value.trim();
      ctaInput.value = '';
      submitQuestion(question);
    }
  });

  ctaSubmit.addEventListener('click', () => {
    if (ctaInput.value.trim()) {
      const question = ctaInput.value.trim();
      ctaInput.value = '';
      submitQuestion(question);
    }
  });
}

// =========================================
// Event Listeners - Page Search Input (subpages)
// =========================================

if (pageSearchInput && pageSearchSubmit) {
  pageSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && pageSearchInput.value.trim()) {
      const question = pageSearchInput.value.trim();
      pageSearchInput.value = '';
      submitQuestion(question);
    }
  });

  pageSearchSubmit.addEventListener('click', () => {
    if (pageSearchInput.value.trim()) {
      const question = pageSearchInput.value.trim();
      pageSearchInput.value = '';
      submitQuestion(question);
    }
  });
}

// =========================================
// Event Listeners - Report Modal
// =========================================

if (reportClose) {
  reportClose.addEventListener('click', closeReportModal);
}

if (reportModal) {
  reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) {
      closeReportModal();
    }
  });

  // Focus trap for report modal
  reportModal.addEventListener('keydown', (e) => {
    if (reportModal.classList.contains('active')) {
      trapFocus(e, reportModal.querySelector('.report-modal-content'));
    }
  });
}

// Report CTA opens form modal with question prefilled
if (reportCta) {
  reportCta.addEventListener('click', () => {
    closeReportModal();
    setTimeout(() => openFormModal(lastQuestion), 300);
  });
}

// =========================================
// Event Listeners - Form Modal
// =========================================

if (ctaButton) {
  ctaButton.addEventListener('click', openFormModal);
}

if (formClose) {
  formClose.addEventListener('click', closeFormModal);
}

if (formModal) {
  formModal.addEventListener('click', (e) => {
    if (e.target === formModal) {
      closeFormModal();
    }
  });

  // Focus trap for form modal
  formModal.addEventListener('keydown', (e) => {
    if (formModal.classList.contains('active')) {
      trapFocus(e, formModal.querySelector('.form-modal-content'));
    }
  });
}

// Handle form submission
if (consultationForm) {
  // Clear error on input
  consultationForm.querySelectorAll('input, textarea').forEach(field => {
    field.addEventListener('input', () => clearFieldError(field));
  });

  consultationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormErrors();

    // Validate required fields
    const nameField = document.getElementById('name');
    const emailField = document.getElementById('email');
    const messageField = document.getElementById('message');
    let isValid = true;

    if (!nameField.value.trim()) {
      showFieldError(nameField, 'Please enter your name');
      isValid = false;
    }

    if (!emailField.value.trim()) {
      showFieldError(emailField, 'Please enter your email');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailField.value)) {
      showFieldError(emailField, 'Please enter a valid email address');
      isValid = false;
    }

    if (!messageField.value.trim()) {
      showFieldError(messageField, 'Please tell us how we can help');
      isValid = false;
    }

    if (!isValid) {
      // Focus first invalid field
      const firstInvalid = consultationForm.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const formData = new FormData(consultationForm);

    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString(),
      });

      if (response.ok) {
        consultationForm.classList.add('hidden');
        formSuccess.classList.add('show');
        setTimeout(() => {
          closeFormModal();
        }, 3000);
      } else {
        throw new Error('Form submission failed');
      }
    } catch (error) {
      console.error('Form error:', error);
      showFieldError(messageField, 'There was a problem submitting the form. Please try again.');
    }
  });
}

// =========================================
// Escape Key Handler
// =========================================

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (reportModal && reportModal.classList.contains('active')) {
      closeReportModal();
    }
    if (formModal && formModal.classList.contains('active')) {
      closeFormModal();
    }
  }
});

// =========================================
// Scroll Animations
// =========================================

const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.2,
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

document.querySelectorAll('[data-animate]').forEach((el) => {
  observer.observe(el);
});

document.querySelectorAll('.case-study').forEach((el) => {
  observer.observe(el);
});

document.querySelectorAll('.founder').forEach((el) => {
  observer.observe(el);
});

// =========================================
// Scroll Indicator Hide
// =========================================

const scrollIndicator = document.querySelector('.scroll-indicator');

if (scrollIndicator) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
      scrollIndicator.style.opacity = '0';
    } else {
      scrollIndicator.style.opacity = '1';
    }
  }, { passive: true });
}

// =========================================
// Smooth Scroll for Anchor Links
// =========================================

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  });
});

// =========================================
// Placeholder Cycling (homepage only)
// =========================================

if (chatInput) {
  function cyclePlaceholder() {
    // Only cycle if input is empty and not focused
    if (chatInput.value === '' && document.activeElement !== chatInput) {
      placeholderIndex = (placeholderIndex + 1) % placeholderExamples.length;
      chatInput.placeholder = placeholderExamples[placeholderIndex];
    }
  }

  function startPlaceholderCycling() {
    if (!placeholderInterval) {
      placeholderInterval = setInterval(cyclePlaceholder, 2500);
    }
  }

  function stopPlaceholderCycling() {
    if (placeholderInterval) {
      clearInterval(placeholderInterval);
      placeholderInterval = null;
    }
  }

  // Start cycling
  startPlaceholderCycling();

  // Pause when page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPlaceholderCycling();
    } else {
      startPlaceholderCycling();
    }
  });
}
