// =========================================
// Crown Consulting Team - Main JavaScript
// =========================================

// State
let isLoading = false;
let lastQuestion = '';

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
// Report Modal Functions
// =========================================

function openReportModal() {
  reportModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  // Show loading, hide result
  reportLoading.classList.remove('hidden');
  reportResult.classList.remove('show');
}

function closeReportModal() {
  reportModal.classList.remove('active');
  document.body.style.overflow = '';
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
  formModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  // Reset form state
  consultationForm.classList.remove('hidden');
  formSuccess.classList.remove('show');
  consultationForm.reset();

  // Prefill message if provided
  if (prefillMessage) {
    const messageField = document.getElementById('message');
    if (messageField) {
      messageField.value = prefillMessage;
    }
  }
}

function closeFormModal() {
  formModal.classList.remove('active');
  document.body.style.overflow = '';
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
}

// Handle form submission
if (consultationForm) {
  consultationForm.addEventListener('submit', async (e) => {
  e.preventDefault();

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
    alert('There was a problem submitting the form. Please try again.');
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

  // Start cycling every 2.5 seconds
  setInterval(cyclePlaceholder, 2500);
}
