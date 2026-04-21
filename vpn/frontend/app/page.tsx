import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <header className="header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
            <path d="M32 4C14.327 4 0 18.327 0 36s14.327 32 32 32 32-14.327 32-32S49.673 4 32 4z" fill="#00D4AA"/>
            <path d="M32 12v40M22 22l10 10 10-10" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: "1.5rem" }}>Lapka VPN</span>
        </div>
        <nav style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <Link href="#features">Возможности</Link>
          <Link href="#pricing">Тарифы</Link>
          <Link href="/login">Вход</Link>
          <Link href="/register" className="btn-primary btn-sm">
            Начать
          </Link>
        </nav>
      </header>

      <section className="hero">
        <h1 style={{ fontSize: "3rem", fontWeight: 800, marginBottom: "1rem", lineHeight: 1.2 }}>
          Защитите свой интернет
          <span style={{ color: "var(--primary)", display: "block" }}>с，速度 до 1 Гбит/с</span>
        </h1>
        <p style={{ fontSize: "1.25rem", color: "var(--text-muted)", marginBottom: "2rem", maxWidth: "540px", margin: "0 auto 2rem" }}>
          Современный VPN на базе WireGuard с серверами по всему миру.
          Без логов, без сложной настройки — просто подключайся и работай.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
          <Link href="/register" className="btn-primary" style={{ padding: "16px 32px", fontSize: "1.1rem" }}>
            Получить доступ
          </Link>
          <Link href="#features" className="btn-secondary" style={{ padding: "16px 32px", fontSize: "1.1rem" }}>
            Узнать больше
          </Link>
        </div>
        
        <div style={{ marginTop: "3rem", display: "flex", gap: "32px", justifyContent: "center", color: "var(--text-muted)" }}>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>50+</div>
            <div>серверов</div>
          </div>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>1Гбит/с</div>
            <div>скорость</div>
          </div>
          <div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>0</div>
            <div>логов</div>
          </div>
        </div>
      </section>

      <section id="features" className="features" style={{ padding: "4rem 0" }}>
        <h2 style={{ textAlign: "center", marginBottom: "3rem", fontSize: "2rem" }}>Почему Lapka VPN</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          <div className="feature">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(0,212,170,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="24" height="24" fill="none" stroke="#00D4AA" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3>Мгновенная активация</h3>
            <p>Подключение через Telegram за 30 секунд. Без регистрации карт и сложных настроек.</p>
          </div>
          <div className="feature">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(0,212,170,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="24" height="24" fill="none" stroke="#00D4AA" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3>Современное шифрование</h3>
            <p>WireGuard — протокол нового поколения. 256-bit encryption, работает быстрее чем OpenVPN.</p>
          </div>
          <div className="feature">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(0,212,170,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="24" height="24" fill="none" stroke="#00D4AA" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.5a2.5 2.5 0 01-2.5 2.5h-2.5A2.5 2.5 0 013 15.5v-2.5a2 2 0 012-2 2 2 0 012-2V9a2 2 0 00-2-2H5.5a2 2 0 00-2 2v2.5a2.5 2.5 0 002.5 2.5h2.5A2.5 2.5 0 0111 15.5v2.5" />
              </svg>
            </div>
            <h3>Серверы по всему миру</h3>
            <p>50+ серверов в Europa, US, Asia. Обходите гео-ограничения и получайте максимальную скорость.</p>
          </div>
          <div className="feature">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(0,212,170,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="24" height="24" fill="none" stroke="#00D4AA" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18.364 5.636l-9.9 9.9m0 0L5.636 18.364m9.9-9.9v0a4 4 0 10-5.657 0m5.657 0a4 4 0 010 5.657m0 0L12 21" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>Без логов</h3>
            <p>Мы не храним логи вашей активности. Ваша приватность — наш приоритет.</p>
          </div>
          <div className="feature">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(0,212,170,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="24" height="24" fill="none" stroke="#00D4AA" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3>Мультиустройства</h3>
            <p>Windows, macOS, Linux, iOS, Android — один аккаунт на всех.</p>
          </div>
          <div className="feature">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(0,212,170,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="24" height="24" fill="none" stroke="#00D4AA" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M16 8v5a3 3 0 006 0v-5a3 3 0 00-3-3h-1m-4 0H7a3 3 0 00-3 3v5a3 3 0 003 3h1m4-8h.01M9 16h.01" />
              </svg>
            </div>
            <h3>Поддержка 24/7</h3>
            <p>Помощь через Telegram. Ответим быстро и по делу.</p>
          </div>
        </div>
      </section>

      <section id="pricing" style={{ padding: "4rem 0", textAlign: "center" }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "2rem" }}>Тарифы</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>Выберите удобный план. Все тарифы с доступом ко всем серверам.</p>
        
        <div style={{ display: "flex", gap: "24px", justifyContent: "center", flexWrap: "wrap", marginTop: "2rem" }}>
          <div className="card" style={{ maxWidth: 320, padding: "32px", textAlign: "left" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "8px" }}>Trial</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--primary)" }}>0₽</div>
            <div style={{ color: "var(--text-muted)", marginBottom: "24px" }}>7 дней</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: "24px" }}>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ Тестовый доступ</li>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ 3 сервера</li>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ Скорость до 100 Мбит/с</li>
              <li style={{ padding: "8px 0" }}>✓ 1 устройство</li>
            </ul>
            <Link href="/register" className="btn-primary" style={{ width: "100%", textAlign: "center", display: "block", padding: "14px" }}>
              Начать
            </Link>
          </div>
          
          <div className="card" style={{ maxWidth: 320, padding: "32px", textAlign: "left", border: "2px solid var(--primary)", transform: "scale(1.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>Pro</div>
              <span style={{ background: "var(--primary)", color: "#000", padding: "4px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600 }}>ПОПУЛЯРНЫЙ</span>
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--primary)" }}>299₽<span style={{ fontSize: "1rem", fontWeight: 400 }}>/мес</span></div>
            <div style={{ color: "var(--text-muted)", marginBottom: "24px" }}>~4₽ в день</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: "24px" }}>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ Все 50+ серверов</li>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ Скорость до 1 Гбит/с</li>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ До 5 устройств</li>
              <li style={{ padding: "8px 0" }}>✓ Приоритетная поддержка</li>
            </ul>
            <Link href="/register?plan=monthly" className="btn-primary" style={{ width: "100%", textAlign: "center", display: "block", padding: "14px" }}>
              Подключить
            </Link>
          </div>
          
          <div className="card" style={{ maxWidth: 320, padding: "32px", textAlign: "left" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "8px" }}>Year</div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--primary)" }}>2490₽<span style={{ fontSize: "1rem", fontWeight: 400 }}>/год</span></div>
            <div style={{ color: "var(--text-muted)", marginBottom: "24px" }}>≈207₽/мес (с экономия 30%)</div>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: "24px" }}>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ Все 50+ серверов</li>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ Скорость до 1 Гбит/с</li>
              <li style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>✓ До 10 устройств</li>
              <li style={{ padding: "8px 0" }}>✓ VIP поддержка</li>
            </ul>
            <Link href="/register?plan=yearly" className="btn-secondary" style={{ width: "100%", textAlign: "center", display: "block", padding: "14px" }}>
              Экономия 30%
            </Link>
          </div>
        </div>
        
        <div style={{ marginTop: "3rem", padding: "24px", background: "var(--card)", borderRadius: 16, maxWidth: 600, margin: "3rem auto 0" }}>
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>🔒 Гарантия возврата денег</div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Если VPN не работает — вернем деньги за неиспользованный период. Без вопросов, без споров.</p>
        </div>
      </section>

      <section style={{ padding: "4rem 0", textAlign: "center", borderTop: "1px solid var(--border)" }}>
        <h2 style={{ marginBottom: "1rem", fontSize: "2rem" }}>Остались вопросы?</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>Напишите нам в Telegram — поможем разобраться</p>
        <a href="https://t.me/VPNLapka_bot" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px" }}>
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
          Написать в Telegram
        </a>
      </section>
      
      <footer style={{ padding: "2rem 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem", borderTop: "1px solid var(--border)" }}>
        <p>© 2025 Lapka VPN. Все права защищены.</p>
        <p style={{ marginTop: "8px" }}>
          <a href="#" style={{ color: "inherit", margin: "0 12px" }}>Политика конфиденциальности</a>
          <a href="#" style={{ color: "inherit", margin: "0 12px" }}>Оферта</a>
        </p>
      </footer>
    </main>
  );
}