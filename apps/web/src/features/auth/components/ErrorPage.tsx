import type { ReactNode } from 'react';

export interface ErrorPageProps {
  code: '403' | '404';
  title: string;
  message: string;
  children?: ReactNode;
}

function ErrorArtwork({ code }: Pick<ErrorPageProps, 'code'>) {
  if (code === '403') {
    return (
      <svg
        className="error-illustration error-illustration--door"
        viewBox="0 0 720 315"
        fill="none"
        aria-hidden="true"
      >
        <g fill="#eff4f7">
          <path d="M28 130h52v14H28zm16 20h30v14H44zm433-112h32v14h-32zm17 19h46v14h-46zm139 103h40v14h-40z" />
        </g>
        <g
          fill="#e8eff3"
          fontFamily="Arial, sans-serif"
          fontWeight="800"
          fontSize="245"
        >
          <text x="68" y="275">
            4
          </text>
          <text x="470" y="275">
            3
          </text>
        </g>
        <path d="M276 283V183a84 84 0 0 1 168 0v100" fill="#e8eff3" />
        <path
          d="M306 283v-91a54 65 0 0 1 108 0v91Z"
          fill="#fff"
          stroke="#78889a"
          strokeWidth="3"
        />
        <path d="M333 148v133m27-153v153m27-133v133" stroke="#e6ebef" />
        <circle
          cx="360"
          cy="176"
          r="20"
          fill="#f7f9fb"
          stroke="#7b8999"
          strokeWidth="2"
        />
        <circle cx="360" cy="176" r="15" stroke="#9ba6b4" />
        <circle cx="324" cy="219" r="4" stroke="#7b8999" />
        <circle cx="324" cy="235" r="6" fill="#eef2f5" stroke="#7b8999" />
        <path
          d="M324 235h17"
          stroke="#7b8999"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect
          x="372"
          y="218"
          width="34"
          height="16"
          rx="2"
          fill="#748296"
          transform="rotate(6 372 218)"
        />
        <text
          x="377"
          y="229"
          fontSize="7"
          fill="white"
          transform="rotate(6 377 229)"
        >
          CLOSED
        </text>
        <path d="M70 285h580" stroke="#bdd1da" strokeWidth="4" />
        <path
          d="M620 282c-25-29-14-59 8-70-2 18-2 26-2 26 30-15 38-6 19 15 28-4 5 26-25 29"
          fill="#b4cad4"
        />
        <path
          d="M94 113c7 46 150-1 129 48-21 49-93-20-114 29-20 49 123 12 118 54-4 34-83 27-102 37"
          stroke="#a8bfcb"
          strokeDasharray="4 4"
        />
        <path d="m76 107 30-7-10 22-5-11Z" fill="#85aabd" />
        <ellipse cx="273" cy="289" rx="34" ry="5" fill="#dfe8ee" />
        <path
          d="m278 248-9 38-25-9-7-18"
          stroke="#353158"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M277 242c21-7 29 8 26 23l-2 22c-14 2-29-3-29-16Z"
          fill="#13aeb8"
        />
        <circle cx="282" cy="230" r="11" fill="#f5c2a3" />
        <path
          d="M270 231c-5-15 14-18 21-9 6 8-1 16-4 15l-4-9-6 2Z"
          fill="#353158"
        />
        <ellipse cx="457" cy="303" rx="33" ry="5" fill="#e4e9ee" />
        <path d="m447 243-3 43m17-43-7 43" stroke="#f16f7b" strokeWidth="12" />
        <path d="M442 204c19-2 28 10 26 26l-3 21-28-2 2-25Z" fill="#353158" />
        <circle cx="451" cy="190" r="12" fill="#f5c2a3" />
        <path
          d="M440 191c-11-16 8-23 18-13 7 7 3 17 0 20l-5-12Z"
          fill="#353158"
        />
      </svg>
    );
  }
  return (
    <svg
      className="error-illustration error-illustration--canyon"
      viewBox="0 0 1440 410"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <g fill="#fff">
        <path d="M120 66c-22-9-25-27 0-30 9-24 58-25 70-3 33-3 45 25 14 28-8 18-59 21-70 5Z" />
        <path d="M1170 92c-31-5-30-32-3-34 7-28 58-30 72-3 34-10 58 22 24 29-11 23-55 21-67 8Z" />
      </g>
      <path
        d="M0 153 116 160l102 22 87 22-45 32-45 45-26 65-17 64H0Z"
        fill="#656564"
      />
      <path
        d="m0 186 57 15-25 91-17 105 42 13-5-158 47-78 52-12 52 29 45 13-23 18-88-13-65 28-39-12L0 238Z"
        fill="#555554"
      />
      <path
        d="m0 153 127 9 80 21 99 21-48 12-86-20-75 9-53-13L0 200Z"
        fill="#9b9b98"
      />
      <path
        d="m1440 153-108 9-90 22-111 20 37 31 8 56 20 57 17 62h227Z"
        fill="#656564"
      />
      <path
        d="m1440 187-50 14 23 85 17 124-39-13 2-144-48-72-51-10-54 31-55 9 27 17 88-15 62 28 43-11 35 14 50-11Z"
        fill="#555554"
      />
      <path
        d="m1440 153-116 9-91 21-102 21 42 12 88-21 73 10 54-13 52 8Z"
        fill="#9b9b98"
      />
      <g stroke="#8c6937" strokeWidth="9">
        <path d="m217 205 142-37m-112 50 139-38m704 26 135-38m-108 48 135-37" />
      </g>
      <g fill="#a58250">
        <path d="m220 212 55-40 22 5-54 40Zm42 7 58-41 20 4-59 42Zm60 1 50-37 18 4-49 38Zm58-43 15 3-6 57-13-3Z" />
        <path d="m1055 204 18-6 69 26-19 8Zm42-16 20-7 69 26-21 9Zm45-9 18-6 65 24-22 8Z" />
      </g>
      <path d="M82 123v65" stroke="#73502c" strokeWidth="10" />
      <path d="M37 129h66v13H37l-10-7Zm28 24h63l9 7-9 8H65Z" fill="#73502c" />
      <path d="m27 215 17-45h13l17 45Z" fill="#f58b3a" />
      <path d="M35 192h30m-34 12h38" stroke="#fff" strokeWidth="5" />
      <path d="m743 410 25-58" stroke="#ee777b" strokeWidth="17" />
      <path
        d="m765 356 9-26-2-14m3 15 8-27m-4 32 14-23m-9 28 18-19m-33 18-6-16"
        stroke="#eed784"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="m754 357 20 8" stroke="#edcf73" strokeWidth="10" />
      <g fill="#303030" transform="translate(830 32) rotate(-12)">
        <path d="m0 0 12 5 14-9 5 4-9 11 15 7-3 6-20-4-11 9-6-3 7-12-11-8Z" />
        <circle cx="-23" cy="8" r="2" />
        <circle cx="-42" cy="8" r="2" />
        <circle cx="-61" cy="8" r="2" />
      </g>
    </svg>
  );
}

export function ErrorPage({ code, title, message, children }: ErrorPageProps) {
  return (
    <main
      className={`error-page error-page--${code}`}
      aria-labelledby="error-page-title"
    >
      <ErrorArtwork code={code} />
      <section className="error-page__content">
        {code === '404' ? <p className="error-page__numeral">404</p> : null}
        <h1 id="error-page-title" className="error-page__title">
          {title}
        </h1>
        <p className="error-page__message">{message}</p>
        {children ? (
          <div className="error-page__actions">{children}</div>
        ) : null}
      </section>
    </main>
  );
}
