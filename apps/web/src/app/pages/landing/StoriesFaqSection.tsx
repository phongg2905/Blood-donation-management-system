import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HeartHandshake, HelpCircle, MessageSquareQuote, Quote } from 'lucide-react';
import { FAQ_ITEMS, HUMAN_STORIES, LANDING_ANCHORS } from './landing-content';

export function StoriesFaqSection() {
  const [openFaq, setOpenFaq] = useState<string | null>('faq-1');

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => (prev === id ? null : id));
  };

  return (
    <section
      className="medical-section"
      id={LANDING_ANCHORS.storiesFaq}
      aria-labelledby="stories-faq-title"
    >
      <div className="medical-container">
        {/* Section Header */}
        <motion.div
          className="medical-head"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5 }}
        >
          <div className="medical-badge medical-badge--blue">
            <HeartHandshake size={14} /> Chia sẻ & Giải đáp
          </div>
          <h2 className="medical-title" id="stories-faq-title">
            Câu Chuyện Thực Tế & <span className="medical-title__highlight">Hỏi Đáp Y Khoa</span>
          </h2>
          <p className="medical-subtitle">
            Lắng nghe tâm sự từ những y bác sĩ nơi phòng cấp cứu, những tình nguyện viên bền bỉ
            và giải đáp mọi thắc mắc trước khi bạn bắt đầu hành trình hiến máu.
          </p>
        </motion.div>

        {/* 2-Column Grid: Stories on Left, FAQ Accordion on Right */}
        <div className="stories-faq-grid">
          {/* Column 1: Stories / Testimonials */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <MessageSquareQuote size={20} color="#2563eb" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Nhịp cầu nhân ái
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {HUMAN_STORIES.map((story, idx) => (
                <motion.div
                  key={story.author}
                  className="story-card"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.45, delay: idx * 0.1 }}
                >
                  <Quote
                    size={28}
                    color="#bfdbfe"
                    style={{ position: 'absolute', top: 16, right: 16, opacity: 0.6 }}
                  />
                  <p className="story-card__quote">"{story.quote}"</p>

                  <div className="story-card__author">
                    <div className="story-card__avatar">{story.avatarText}</div>
                    <div>
                      <div className="story-card__name">{story.author}</div>
                      <div className="story-card__role">{story.role}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '0.85rem',
                      display: 'inline-block',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#2563eb',
                      backgroundColor: '#eff6ff',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '9999px',
                    }}
                  >
                    ★ {story.highlight}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Column 2: FAQ Accordion */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <HelpCircle size={20} color="#2563eb" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Thắc mắc thường gặp
              </h3>
            </div>

            <div className="faq-list">
              {FAQ_ITEMS.map((faq) => {
                const isOpen = openFaq === faq.id;

                return (
                  <div
                    key={faq.id}
                    className={`faq-item ${isOpen ? 'faq-item--open' : ''}`}
                  >
                    <button
                      type="button"
                      className="faq-trigger"
                      onClick={() => toggleFaq(faq.id)}
                      aria-expanded={isOpen}
                    >
                      <span>{faq.question}</span>
                      <ChevronDown size={18} className="faq-trigger__icon" />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="faq-content">{faq.answer}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Quick Consultation Callout */}
            <div
              style={{
                marginTop: '1.75rem',
                padding: '1.25rem',
                borderRadius: '1rem',
                backgroundColor: '#f8fafc',
                border: '1px dashed #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                  Bạn vẫn còn băn khoăn về sức khỏe của mình?
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  Đội ngũ bác sĩ tư vấn luôn sẵn sàng hỗ trợ trực tuyến 24/7.
                </div>
              </div>
              <a
                href="tel:19001234"
                style={{
                  color: '#2563eb',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid #bfdbfe',
                }}
              >
                Hotline: 1900 1234
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
