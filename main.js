// =========================================
// Crown Consulting Team - Main JavaScript
// =========================================

// State
let conversationHistory = [];
let messageCount = 0;
let isLoading = false;

// DOM Elements - Chat
const chatInput = document.getElementById('chatInput');
const chatSubmit = document.getElementById('chatSubmit');
const chatModal = document.getElementById('chatModal');
const chatClose = document.getElementById('chatClose');
const chatMessages = document.getElementById('chatMessages');
const chatModalInput = document.getElementById('chatModalInput');
const chatModalSubmit = document.getElementById('chatModalSubmit');
const ctaInput = document.getElementById('ctaInput');
const ctaSubmit = document.getElementById('ctaSubmit');

// DOM Elements - Form
const formModal = document.getElementById('formModal');
const formClose = document.getElementById('formClose');
const consultationForm = document.getElementById('consultationForm');
const formSuccess = document.getElementById('formSuccess');
const ctaButton = document.getElementById('ctaButton');

// =========================================
// Chat Functions
// =========================================

function openChatModal() {
  chatModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => chatModalInput.focus(), 300);
}

function closeChatModal() {
  chatModal.classList.remove('active');
  document.body.style.overflow = '';
}

function addMessage(content, role) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;

  if (role === 'assistant') {
    // Parse markdown-like content (basic)
    const formatted = formatMessage(content);
    messageDiv.innerHTML = formatted;
  } else {
    messageDiv.textContent = content;
  }

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Add AI disclosure after first assistant message
  if (role === 'assistant' && messageCount === 1) {
    setTimeout(() => {
      const disclosure = document.createElement('div');
      disclosure.className = 'ai-disclosure';
      disclosure.innerHTML = "This answer came from Crown's AI. We're not sitting at the computer—we're out helping clients. <strong>Want this for your business?</strong>";
      chatMessages.appendChild(disclosure);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 500);
  }
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
  }

  return formatted;
}

function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.id = 'typingIndicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

async function sendMessage(message) {
  if (!message.trim() || isLoading) return;

  isLoading = true;
  messageCount++;

  // Add user message to history and UI
  conversationHistory.push({ role: 'user', content: message });
  addMessage(message, 'user');

  // Show typing indicator
  showTypingIndicator();

  // Disable inputs
  chatModalSubmit.disabled = true;

  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: conversationHistory }),
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    const assistantMessage = data.message;

    // Add assistant message to history and UI
    conversationHistory.push({ role: 'assistant', content: assistantMessage });
    hideTypingIndicator();
    addMessage(assistantMessage, 'assistant');

  } catch (error) {
    console.error('Chat error:', error);
    hideTypingIndicator();
    addMessage("I apologize, but I'm having trouble connecting right now. Please try again or book a free consultation directly.", 'assistant');
  } finally {
    isLoading = false;
    chatModalSubmit.disabled = false;
    chatModalInput.focus();
  }
}

// =========================================
// Form Modal Functions
// =========================================

function openFormModal() {
  formModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  // Reset form state
  consultationForm.classList.remove('hidden');
  formSuccess.classList.remove('show');
  consultationForm.reset();
}

function closeFormModal() {
  formModal.classList.remove('active');
  document.body.style.overflow = '';
}

// =========================================
// Event Listeners - Chat
// =========================================

// Hero input
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    const message = chatInput.value.trim();
    chatInput.value = '';
    openChatModal();
    setTimeout(() => sendMessage(message), 300);
  }
});

chatSubmit.addEventListener('click', () => {
  if (chatInput.value.trim()) {
    const message = chatInput.value.trim();
    chatInput.value = '';
    openChatModal();
    setTimeout(() => sendMessage(message), 300);
  }
});

// Modal input
chatModalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatModalInput.value.trim()) {
    const message = chatModalInput.value.trim();
    chatModalInput.value = '';
    sendMessage(message);
  }
});

chatModalSubmit.addEventListener('click', () => {
  if (chatModalInput.value.trim()) {
    const message = chatModalInput.value.trim();
    chatModalInput.value = '';
    sendMessage(message);
  }
});

// Close chat modal
chatClose.addEventListener('click', closeChatModal);

chatModal.addEventListener('click', (e) => {
  if (e.target === chatModal) {
    closeChatModal();
  }
});

// CTA input
ctaInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && ctaInput.value.trim()) {
    const message = ctaInput.value.trim();
    ctaInput.value = '';
    openChatModal();
    setTimeout(() => sendMessage(message), 300);
  }
});

ctaSubmit.addEventListener('click', () => {
  if (ctaInput.value.trim()) {
    const message = ctaInput.value.trim();
    ctaInput.value = '';
    openChatModal();
    setTimeout(() => sendMessage(message), 300);
  }
});

// =========================================
// Event Listeners - Form Modal
// =========================================

// CTA Button opens form modal
ctaButton.addEventListener('click', openFormModal);

// Close form modal
formClose.addEventListener('click', closeFormModal);

formModal.addEventListener('click', (e) => {
  if (e.target === formModal) {
    closeFormModal();
  }
});

// Handle form submission
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
      // Show success state
      consultationForm.classList.add('hidden');
      formSuccess.classList.add('show');

      // Close modal after delay
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

// =========================================
// Escape Key Handler (for both modals)
// =========================================

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (chatModal.classList.contains('active')) {
      closeChatModal();
    }
    if (formModal.classList.contains('active')) {
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
      // Optionally stop observing after animation
      // observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe all elements with data-animate attribute
document.querySelectorAll('[data-animate]').forEach((el) => {
  observer.observe(el);
});

// Observe case studies
document.querySelectorAll('.case-study').forEach((el) => {
  observer.observe(el);
});

// Observe founders
document.querySelectorAll('.founder').forEach((el) => {
  observer.observe(el);
});

// =========================================
// Scroll Indicator Hide
// =========================================

const scrollIndicator = document.querySelector('.scroll-indicator');

window.addEventListener('scroll', () => {
  if (window.scrollY > 100) {
    scrollIndicator.style.opacity = '0';
  } else {
    scrollIndicator.style.opacity = '1';
  }
}, { passive: true });

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
