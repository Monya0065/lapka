"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="section">
        <h1 className="page-title">Настройки системы</h1>
        <p className="page-subtitle">Конфигурация VPN сервиса</p>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div className="card">
          <h3>📋 Как добавить VPN ноду</h3>
          <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "12px" }}>
            <ol style={{ paddingLeft: "20px", lineHeight: 1.8 }}>
              <li>Арендуйте сервер (VPS) с Ubuntu 22.04</li>
              <li>Сгенерируйте ключи на сервере:
                <pre style={{ background: "#1a1a1a", padding: "12px", borderRadius: "8px", margin: "8px 0", overflow: "auto", fontSize: "0.8rem" }}>
{`# sudo apt update && sudo apt install wireguard-tools
# wg genkey | sudo tee /etc/wireguard/privatekey | wg pubkey | sudo tee /etc/wireguard/publickey`}
                </pre>
              </li>
              <li>Получите публичный ключ:
                <pre style={{ background: "#1a1a1a", padding: "12px", borderRadius: "8px", margin: "8px 0", fontSize: "0.8rem" }}>
# sudo cat /etc/wireguard/publickey
(скопируйте этот ключ)</pre>
              </li>
              <li>Настройте WireGuard сервер (/etc/wireguard/wg0.conf)</li>
              <li>Добавьте ноду здесь, указав:
                <ul style={{ marginTop: "8px" }}>
                  <li><strong>Region</strong> — локация сервера</li>
                  <li><strong>Endpoint</strong> — хост:порт (например, vpn.example.com:51820)</li>
                  <li><strong>Public Key</strong> — ключ из пункта 2</li>
                </ul>
              </li>
            </ol>
          </div>
        </div>

        <div className="card">
          <h3>🔧 Переменные окружения</h3>
          <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "12px" }}>
            <p style={{ marginBottom: "12px" }}>Настройки в <code>.env</code> файле:</p>
            
            <div style={{ background: "#1a1a1a", padding: "12px", borderRadius: "8px", fontSize: "0.8rem", overflow: "auto" }}>
              <div># База данных</div>
              <div style={{ color: "#00D4AA" }}>DATABASE_URL=postgresql://vpn:vpn@postgres:5432/vpn</div>
              <br />
              <div># Redis</div>
              <div style={{ color: "#00D4AA" }}>REDIS_URL=redis://redis:6379</div>
              <br />
              <div># JWT</div>
              <div style={{ color: "#00D4AA" }}>JWT_SECRET=ваш-секретный-ключ</div>
              <br />
              <div># Telegram бот</div>
              <div style={{ color: "#00D4AA" }}>TELEGRAM_BOT_TOKEN=123456:AAH...</div>
              <br />
              <div># YooKassa (платежи)</div>
              <div style={{ color: "#00D4AA" }}>YOOKASSA_SHOP_ID=123456</div>
              <div style={{ color: "#00D4AA" }}>YOOKASSA_SECRET_KEY=test_...</div>
              <br />
              <div># SMTP (email)</div>
              <div style={{ color: "#00D4AA" }}>SMTP_HOST=smtp.gmail.com</div>
              <div style={{ color: "#00D4AA" }}>SMTP_PORT=587</div>
              <div style={{ color: "#00D4AA" }}>SMTP_USER=your@gmail.com</div>
              <div style={{ color: "#00D4AA" }}>SMTP_PASSWORD=app-password</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>💳 Настройка платежей (YooKassa)</h3>
          <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "12px" }}>
            <ol style={{ paddingLeft: "20px", lineHeight: 1.8 }}>
              <li>Зарегистрируйтесь на <a href="https://yookassa.ru" target="_blank" style={{ color: "var(--primary)" }}>yookassa.ru</a></li>
              <li>Создайте магазин в кабинете</li>
              <li>Получите ShopId и SecretKey</li>
              <li>Добавьте в <code>.env</code>:
                <pre style={{ background: "#1a1a1a", padding: "8px", borderRadius: "8px", margin: "8px 0", fontSize: "0.8rem" }}>
YOOKASSA_SHOP_ID=ваш_shop_id
YOOKASSA_SECRET_KEY=ваш_secret</pre>
              </li>
              <li>Настройте webhook URL:
                <pre style={{ background: "#1a1a1a", padding: "8px", borderRadius: "8px", margin: "8px 0", fontSize: "0.8rem" }}>
https://ваш-домен/api/billing/webhook/yookassa</pre>
              </li>
            </ol>
          </div>
        </div>

        <div className="card">
          <h3>📧 Настройка email (SMTP)</h3>
          <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "12px" }}>
            <ol style={{ paddingLeft: "20px", lineHeight: 1.8 }}>
              <li>Для Gmail используйте <a href="https://support.google.com/accounts/answer/185834" target="_blank" style={{ color: "var(--primary)" }}>App Password</a></li>
              <li>Для Mail.ru / Яндекс — обычный пароль</li>
              <li>Добавьте в <code>.env</code>:
                <pre style={{ background: "#1a1a1a", padding: "8px", borderRadius: "8px", margin: "8px 0", fontSize: "0.8rem" }}>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
SMTP_FROM=noreply@yourdomain.com
SMTP_FROM_NAME=Lapka VPN</pre>
              </li>
            </ol>
          </div>
        </div>

        <div className="card">
          <h3>📱 Telegram бот</h3>
          <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "12px" }}>
            <ol style={{ paddingLeft: "20px", lineHeight: 1.8 }}>
              <li>Создайте бота через @BotFather в Telegram</li>
              <li>Получите токен</li>
              <li>Добавьте в <code>.env</code>:
                <pre style={{ background: "#1a1a1a", padding: "8px", borderRadius: "8px", margin: "8px 0", fontSize: "0.8rem" }}>
TELEGRAM_BOT_TOKEN=123456789:AAH...</pre>
              </li>
              <li>Установите Commands в BotFather:
                <pre style={{ background: "#1a1a1a", padding: "8px", borderRadius: "8px", margin: "8px 0", fontSize: "0.8rem" }}>
start - Приветствие
help - Помощь
activate - Активировать VPN
status - Проверить статус</pre>
              </li>
            </ol>
          </div>
        </div>

        <div className="card">
          <h3>🔒 Безопасность</h3>
          <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "12px" }}>
            <ul style={{ paddingLeft: "20px", lineHeight: 1.8 }}>
              <li>Измените <code>JWT_SECRET</code> на длинную случайную строку</li>
              <li>Используйте сложные пароли для БД</li>
              <li>Настройте firewall:
                <pre style={{ background: "#1a1a1a", padding: "8px", borderRadius: "8px", margin: "8px 0", fontSize: "0.8rem" }}>
# ufw allow 22/tcp
# ufw allow 80/tcp
# ufw allow 443/tcp
# ufw allow 51820/udp  # WireGuard</pre>
              </li>
              <li>Настройте SSL (Let's Encrypt):
                <pre style={{ background: "#1a1a1a", padding: "8px", borderRadius: "8px", margin: "8px 0", fontSize: "0.8rem" }}>
# certbot --nginx -d vpn.example.com</pre>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h3>🆘 Troubleshooting</h3>
        <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginTop: "12px" }}>
          <details style={{ marginBottom: "8px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>API не запускается</summary>
            <div style={{ padding: "8px", marginTop: "8px" }}>
              Проверьте логи: <code>docker compose logs api</code>
            </div>
          </details>
          <details style={{ marginBottom: "8px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Не работает Telegram бот</summary>
            <div style={{ padding: "8px", marginTop: "8px" }}>
              Проверьте токен в .env и перезапустите: <code>docker compose up -d --force-recreate bot</code>
            </div>
          </details>
          <details style={{ marginBottom: "8px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Не приходят платежи</summary>
            <div style={{ padding: "8px", marginTop: "8px" }}>
              Проверьте webhook в кабинете YooKassa и настройки .env
            </div>
          </details>
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Не работает VPN подключение</summary>
            <div style={{ padding: "8px", marginTop: "8px" }}>
              Проверьте что WireGuard запущен: <code>sudo wg show</code> и порт 51820 открыт
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}