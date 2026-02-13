'use client';

interface HowToPlayProps {
  onClose: () => void;
}

export default function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div className="htp-modal" onClick={onClose}>
      <div className="htp-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="htp-title">HOW TO PLAY</h2>

        <div className="htp-section">
          <p className="htp-section__title">📋 목표</p>
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75em', lineHeight: 1.8, color: '#7a7a9a' }}>
            주문서에 적힌 순서대로 재료를 눌러 햄버거를 만들고 제출하세요!
          </p>
        </div>

        <div className="htp-section">
          <p className="htp-section__title">⌨️ 키보드</p>
          {[
            ['↑ / W', '패티'],
            ['↓ / S', '치즈'],
            ['← / A', '야채'],
            ['→ / D', '소스'],
            ['ESC / ←', '재료 취소'],
            ['Enter / Space', '버거 제출'],
          ].map(([key, label]) => (
            <div className="htp-key-row" key={key}>
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="htp-section">
          <p className="htp-section__title">⚡ 콤보</p>
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75em', lineHeight: 1.8, color: '#7a7a9a' }}>
            제한 시간의 2/3 이내로 제출하면 콤보! 콤보가 쌓일수록 점수가 올라가요.
          </p>
        </div>

        <div className="htp-section">
          <p className="htp-section__title">❤️ HP</p>
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75em', lineHeight: 1.8, color: '#7a7a9a' }}>
            시간이 지나면 HP가 줄어들어요. 버거를 잘못 제출하거나 시간이 초과되면 HP가 크게 감소합니다.
          </p>
        </div>

        <button className="btn btn--ghost" onClick={onClose} style={{ marginTop: '8px' }}>
          닫기
        </button>
      </div>
    </div>
  );
}
