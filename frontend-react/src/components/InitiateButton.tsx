import styled from 'styled-components';

interface InitiateButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const StyledWrapper = styled.div`
  .btn-wrapper {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  .btn {
    --border-radius: 24px;
    --padding: 4px;
    --transition: 0.4s;
    --button-color: #0d0720;
    --highlight-color-hue: 270deg;
    user-select: none;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.65em 1.4em 0.65em 1.1em;
    font-family: 'Space Grotesk', 'Poppins', 'Inter', sans-serif;
    font-size: 1em;
    font-weight: 600;
    background-color: var(--button-color);
    box-shadow:
      inset 0px 1px 1px rgba(168, 85, 247, 0.2),
      inset 0px 2px 2px rgba(168, 85, 247, 0.15),
      inset 0px 4px 4px rgba(168, 85, 247, 0.1),
      inset 0px 8px 8px rgba(168, 85, 247, 0.05),
      inset 0px 16px 16px rgba(168, 85, 247, 0.05),
      0px -1px 1px rgba(0, 0, 0, 0.02),
      0px -2px 2px rgba(0, 0, 0, 0.03),
      0px -4px 4px rgba(0, 0, 0, 0.05),
      0px -8px 8px rgba(0, 0, 0, 0.06),
      0px -16px 16px rgba(0, 0, 0, 0.08);
    border: solid 1px rgba(168, 85, 247, 0.2);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition:
      box-shadow var(--transition),
      border var(--transition),
      background-color var(--transition),
      opacity var(--transition);
  }

  .btn.disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }

  .btn::before {
    content: '';
    position: absolute;
    top: calc(0px - var(--padding));
    left: calc(0px - var(--padding));
    width: calc(100% + var(--padding) * 2);
    height: calc(100% + var(--padding) * 2);
    border-radius: calc(var(--border-radius) + var(--padding));
    pointer-events: none;
    background-image: linear-gradient(0deg, #0004, #000a);
    z-index: -1;
    transition: box-shadow var(--transition), filter var(--transition);
    box-shadow:
      0 -8px 8px -6px #0000 inset,
      0 -16px 16px -8px #00000000 inset,
      1px 1px 1px rgba(168, 85, 247, 0.15),
      2px 2px 2px rgba(168, 85, 247, 0.08),
      -1px -1px 1px #0002,
      -2px -2px 2px #0001;
  }

  .btn::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    pointer-events: none;
    background-image: linear-gradient(
      0deg,
      #fff,
      hsl(var(--highlight-color-hue), 100%, 70%),
      hsla(var(--highlight-color-hue), 100%, 70%, 50%),
      8%,
      transparent
    );
    background-position: 0 0;
    opacity: 0;
    transition: opacity var(--transition), filter var(--transition);
  }

  .btn-letter {
    position: relative;
    display: inline-block;
    color: rgba(192, 132, 252, 0.6);
    animation: letter-anim 2s ease-in-out infinite;
    transition: color var(--transition), text-shadow var(--transition), opacity var(--transition);
  }

  @keyframes letter-anim {
    50% {
      text-shadow: 0 0 6px rgba(192, 132, 252, 0.9);
      color: #e9d5ff;
    }
  }

  .btn-svg {
    flex-grow: 0;
    flex-shrink: 0;
    height: 22px;
    margin-right: 0.55rem;
    fill: none;
    stroke: #c084fc;
    stroke-width: 1.5;
    animation: flicker 2s linear infinite;
    animation-delay: 0.5s;
    filter: drop-shadow(0 0 3px rgba(168, 85, 247, 0.8));
    transition: stroke var(--transition), filter var(--transition), opacity var(--transition);
  }

  @keyframes flicker {
    50% { opacity: 0.4; }
  }

  .txt-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 10em;
    height: 1.4em;
  }

  .txt-1,
  .txt-2 {
    position: absolute;
    word-spacing: -1em;
    white-space: nowrap;
  }

  .txt-1 { animation: appear-anim 1s ease-in-out forwards; }
  .txt-2 { opacity: 0; }

  @keyframes appear-anim {
    0%   { opacity: 0; }
    100% { opacity: 1; }
  }

  .btn:focus .txt-1 {
    animation: opacity-anim 0.3s ease-in-out forwards;
    animation-delay: 1s;
  }
  .btn:focus .txt-2 {
    animation: opacity-anim 0.3s ease-in-out reverse forwards;
    animation-delay: 1s;
  }

  @keyframes opacity-anim {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }

  .btn:focus .btn-letter {
    animation:
      focused-letter-anim 1s ease-in-out forwards,
      letter-anim 1.2s ease-in-out infinite;
    animation-delay: 0s, 1s;
  }

  @keyframes focused-letter-anim {
    0%, 100% { filter: blur(0px); }
    50% {
      transform: scale(2);
      filter: blur(10px) brightness(150%)
        drop-shadow(-36px 12px 12px hsl(var(--highlight-color-hue), 100%, 70%));
    }
  }

  .btn:focus .btn-svg {
    animation-duration: 1.2s;
    animation-delay: 0.2s;
  }

  .btn:focus::before {
    box-shadow:
      0 -8px 12px -6px rgba(168, 85, 247, 0.4) inset,
      0 -16px 16px -8px hsla(270deg, 100%, 70%, 0.2) inset,
      1px 1px 1px rgba(168, 85, 247, 0.3),
      2px 2px 2px rgba(168, 85, 247, 0.1),
      -1px -1px 1px #0002,
      -2px -2px 2px #0001;
  }

  .btn:focus::after {
    opacity: 0.5;
    mask-image: linear-gradient(0deg, #fff, transparent);
    filter: brightness(100%);
  }

  /* Animation delays */
  .btn-letter:nth-child(1)  { animation-delay: 0s; }
  .btn-letter:nth-child(2)  { animation-delay: 0.08s; }
  .btn-letter:nth-child(3)  { animation-delay: 0.16s; }
  .btn-letter:nth-child(4)  { animation-delay: 0.24s; }
  .btn-letter:nth-child(5)  { animation-delay: 0.32s; }
  .btn-letter:nth-child(6)  { animation-delay: 0.40s; }
  .btn-letter:nth-child(7)  { animation-delay: 0.48s; }
  .btn-letter:nth-child(8)  { animation-delay: 0.56s; }
  .btn-letter:nth-child(9)  { animation-delay: 0.64s; }
  .btn-letter:nth-child(10) { animation-delay: 0.72s; }
  .btn-letter:nth-child(11) { animation-delay: 0.80s; }
  .btn-letter:nth-child(12) { animation-delay: 0.88s; }
  .btn-letter:nth-child(13) { animation-delay: 0.96s; }
  .btn-letter:nth-child(14) { animation-delay: 1.04s; }
  .btn-letter:nth-child(15) { animation-delay: 1.12s; }
  .btn-letter:nth-child(16) { animation-delay: 1.20s; }

  /* Active */
  .btn:active {
    border: solid 1px hsla(270deg, 100%, 80%, 0.7);
    background-color: hsla(270deg, 50%, 20%, 0.5);
  }
  .btn:active::before {
    box-shadow:
      0 -8px 12px -6px rgba(192, 132, 252, 0.9) inset,
      0 -16px 16px -8px hsla(270deg, 100%, 70%, 0.8) inset,
      1px 1px 1px rgba(255,255,255,0.25),
      2px 2px 2px rgba(255,255,255,0.1),
      -1px -1px 1px #0002,
      -2px -2px 2px #0001;
  }
  .btn:active::after {
    opacity: 1;
    mask-image: linear-gradient(0deg, #fff, transparent);
    filter: brightness(200%);
  }
  .btn:active .btn-letter {
    text-shadow: 0 0 1px hsla(270deg, 100%, 90%, 0.9);
    animation: none;
  }

  /* Hover */
  .btn:hover {
    border: solid 1px hsla(270deg, 100%, 80%, 0.4);
  }
  .btn:hover::before {
    box-shadow:
      0 -8px 8px -6px rgba(192, 132, 252, 0.7) inset,
      0 -16px 16px -8px hsla(270deg, 100%, 70%, 0.3) inset,
      1px 1px 1px rgba(168, 85, 247, 0.2),
      2px 2px 2px rgba(168, 85, 247, 0.1),
      -1px -1px 1px #0002,
      -2px -2px 2px #0001;
  }
  .btn:hover::after {
    opacity: 0.8;
    mask-image: linear-gradient(0deg, #fff, transparent);
  }
  .btn:hover .btn-svg {
    stroke: #e9d5ff;
    filter: drop-shadow(0 0 5px hsl(270deg, 100%, 70%)) drop-shadow(0 -4px 6px #0009);
    animation: none;
  }
`;

const LABEL_1 = 'Initiate Analysis';
const LABEL_2 = 'Analyzing...';

function Letters({ text }: { text: string }) {
  return (
    <>
      {text.split('').map((ch, i) => (
        <span key={i} className="btn-letter">{ch === ' ' ? '\u00A0' : ch}</span>
      ))}
    </>
  );
}

export default function InitiateButton({ onClick, disabled = false }: InitiateButtonProps) {
  return (
    <StyledWrapper>
      <div className="btn-wrapper">
        <button className={`btn${disabled ? ' disabled' : ''}`} onClick={!disabled ? onClick : undefined}>
          {/* Sparkle star icon */}
          <svg className="btn-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>

          <div className="txt-wrapper">
            <div className="txt-1"><Letters text={LABEL_1} /></div>
            <div className="txt-2"><Letters text={LABEL_2} /></div>
          </div>
        </button>
      </div>
    </StyledWrapper>
  );
}
