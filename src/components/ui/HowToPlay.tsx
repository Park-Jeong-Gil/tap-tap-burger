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
            ['A', '야채'],
            ['D', '소스'],
            ['S', '치즈'],
            ['W', '패티'],
            ['Q', '양파'],
            ['E', '토마토'],
            ['ESC / Backspace', '재료 취소'],
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
            제한 시간의 65% 이내로 제출하면 콤보! 콤보가 쌓일수록 점수가 올라가요.
          </p>
          {[
            ['1~2콤보', '×1.5'],
            ['3~5콤보', '×2.0'],
            ['6~9콤보', '×3.0'],
            ['10콤보+', '×5.0'],
          ].map(([combo, mult]) => (
            <div className="htp-key-row" key={combo}>
              <kbd>{combo}</kbd>
              <span>{mult}</span>
            </div>
          ))}
        </div>

        <div className="htp-section">
          <p className="htp-section__title">🔥 피버</p>
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75em', lineHeight: 1.8, color: '#7a7a9a' }}>
            5번 성공마다 피버 돌입! 6초간 지정 재료를 계속 눌러 점수를 쌓으세요.
          </p>
        </div>

        <div className="htp-section">
          <p className="htp-section__title">❤️ HP</p>
          {[
            ['올바른 제출', '+15'],
            ['콤보 제출', '+20'],
            ['잘못된 제출', '-10'],
            ['시간 초과', '-20'],
          ].map(([action, delta]) => (
            <div className="htp-key-row" key={action}>
              <kbd>{action}</kbd>
              <span>{delta}</span>
            </div>
          ))}
          <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.75em', lineHeight: 1.8, color: '#7a7a9a', marginTop: '4px' }}>
            시간이 지날수록 HP가 계속 줄어들어요. HP가 0이 되면 게임 오버!
          </p>
        </div>

        <button className="btn btn--ghost" onClick={onClose} style={{ marginTop: '8px' }}>
          닫기
        </button>
      </div>
    </div>
  );
}
