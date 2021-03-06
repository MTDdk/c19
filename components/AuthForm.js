import { useState, useRef, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { InputWithFix, Checkbox } from './Form';
import { AsYouType, parsePhoneNumberFromString, isValidNumber } from 'libphonenumber-js';
import flag from 'country-code-emoji';
import Link from 'next/link';
import { LanguageContext } from './LanguageSelector';
import LoadingSpinner from './LoadingSpinner';
import authContent from '../content/authForm';

export default function AuthForm({ children }) {
  const router = useRouter();
  const { language } = useContext(LanguageContext);

  const codeInputRef = useRef({});
  const submitBtnRef = useRef(null);

  const [phoneError, setPhoneError] = useState(false);
  const [authError, setAuthError] = useState(false);

  const [authorized, setAuthorized] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [renewing, setRenewing] = useState(0);

  useEffect(() => {
    if (authorized) {
      setRenewing(5);
      setTimeout(() => {
        setAuthorized(false);
      }, 5000);
    }
  }, [authorized]);

  useEffect(() => {
    if (renewing) {
      setTimeout(() => {
        setRenewing(renewing - 1);
      }, 1000);
    } else {
      setPhoneError(false);
    }
  }, [renewing]);

  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [reminders, setReminders] = useState(true);
  const [consent, setConsent] = useState(false);

  const [focused, setFocused] = useState(false);

  const asYouTypeParser = new AsYouType();
  const codeIsComplete = code.length === 6;
  const phoneIsValid = phone && isValidNumber(phone);
  const parsedPhone = parsePhoneNumberFromString(phone);
  const error = phoneError || (phone.length && !focused && (!parsedPhone || !parsedPhone.country || !phoneIsValid));

  const content = authContent[language];

  const verify = async (phone, code, consent) => {
    setVerifying(true);
    setAuthError(false);
    const response = await fetch('/api/post/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone,
        code,
        reminders,
        consent,
      }),
    });
    if (response.ok) {
      const { id } = await response.json();
      router.push('/' + id);
      setVerifying(false);
    } else {
      setVerifying(false);
      setAuthError(content.btn.error);
    }
  };

  const environment = process.browser
    ? origin.includes('c19.dk')
      ? 'production'
      : origin.includes('now.sh')
      ? 'staging'
      : 'development'
    : process.env.NODE_ENV;

  // TODO: don't overwrite with true
  const showTestButton = environment === 'development';

  return (
    <form className="sm:mx-auto sm:w-full max-w-sm sm:px-8 sm:border sm:border-gray-200 sm:rounded-lg sm:py-8 sm:mb-4 mt-4 lg:-mt-12">
      {showTestButton && (
        <button
          onClick={async e => {
            e.preventDefault();
            setPhone('+4599999999');
            setCode('000000');
            setConsent(true);
            setReminders(true);
            verify('+4599999999', '000000', true, true);
          }}
          className="mb-6 bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 p-3 rounded-md w-full">
          {content.testBtn}
        </button>
      )}
      <div className={'bg-white z-50' + (showTestButton ? ' opacity-25' : '')}>
        <div className="w-full">
          <label className="block text-sm font-medium leading-5 text-gray-700">
            {content.phone.label}
            <span className="block text-gray-500 font-normal text-xs">{content.phone.description}</span>
            <div className="-mt-px w-full flex">
              <InputWithFix
                suffix={
                  phoneIsValid && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-teal-500">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  )
                }
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                prefix={'+45'} //parsedPhone && parsedPhone.country ? flag(parsedPhone.country) : '🌍'}
                type="phone"
                value={asYouTypeParser.input(phone).slice(4)}
                onChange={({ value }) => {
                  phoneError && setPhoneError(false);
                  setPhone('+45' + value);
                }}
                placeholder="60 55 07 09"
              />
              <span className="inline-flex rounded-md shadow-sm">
                <button
                  onClick={async e => {
                    setAuthorizing(true);
                    e.preventDefault();
                    if (authorizing || authorized) {
                      setPhoneError(content.phone.error.wait);
                    } else if (!phone || !isValidNumber(phone)) {
                      setPhoneError(content.phone.error.incomplete);
                    } else {
                      const response = await fetch('/api/post/authorize', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          phone: parsePhoneNumberFromString(phone).number,
                          language,
                        }),
                      });
                      if (response.ok) {
                        setPhoneError(false);
                        setAuthorized(true);
                      } else {
                        const error = await response
                          .json()
                          .then(value => {
                            return value && value.error;
                          })
                          .catch(() => {
                            return null;
                          });
                        if (error === 'wrong_country_code') setPhoneError(content.phone.error.wrongCountryCode);
                        else setPhoneError(content.phone.error.unknown);
                      }
                    }
                    setAuthorizing(false);
                  }}
                  className={
                    'relative py-2 px-4 mt-1 ml-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:text-gray-800 focus:outline-none focus:border-teal-500 focus:shadow-outline transition duration-150 ease-in-out'
                  }>
                  {authorizing && (
                    <span className="absolute inset-0 h-full flex items-center justify-center">
                      <LoadingSpinner color="teal" />
                    </span>
                  )}
                  <span className={'flex flex-1 flex-no-wrap' + (authorizing ? ' invisible' : '')}>
                    {authorized ? (
                      <>
                        <span className="hidden sm:inline-block mr-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        {content.phone.btn.sent}{' '}
                      </>
                    ) : (
                      <>
                        {content.phone.btn.send}{' '}
                        <span className="hidden sm:inline-block ml-1">{content.phone.btn.code}</span>
                      </>
                    )}
                  </span>
                </button>
              </span>
            </div>
            {!!error && (
              <p className="mt-2 text-xs font-normal text-red-600">
                {phoneError || content.phone.error.invalid}
                {!!renewing && renewing + ' ' + content.phone.error.secs}
              </p>
            )}
          </label>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium leading-5 text-gray-700 mb-1">
            {content.code.label}
            <span className="block text-gray-500 font-normal text-xs">{content.code.description}</span>
          </label>
          <div className="-mt-px flex">
            {[0, 1, 2, 3, 4, 5].map(idx => (
              <div key={idx} className="-ml-px flex-1 min-w-0 z-30">
                <input
                  maxLength="1"
                  type="number"
                  onPaste={e => {
                    e.preventDefault();
                    const paste = (e.clipboardData || window.clipboardData).getData('text');
                    setCode(paste.replace('c19.dk', '').replace(/\D/g, ''));
                  }}
                  onChange={e => {
                    const value = e.target.value;
                    setCode(
                      [...code]
                        .filter((val, index) => index < idx)
                        .concat(value)
                        .join('')
                    );
                    if (value) {
                      const nextField = codeInputRef.current[idx + 1];
                      idx !== 5 && nextField
                        ? nextField.focus()
                        : setTimeout(() => {
                            submitBtnRef.current && submitBtnRef.current.focus();
                          }, 100);
                    }
                  }}
                  value={[...code][idx] || ''}
                  ref={input => (codeInputRef.current[idx] = input)}
                  className={`form-input relative block w-full rounded-none ${
                    idx === 0 ? 'rounded-l-md ' : idx === 5 ? 'rounded-r-md ' : ''
                  }bg-transparent transition text-center ease-in-out duration-150 sm:text-sm sm:leading-5 px-0 sm:px-auto`}
                  placeholder="0"
                />
              </div>
            ))}
            <div className="relative flex items-center justify-center text-sm leading-5 ml-2">
              <button
                disabled={!code.length}
                onClick={e => {
                  e.preventDefault();
                  setCode('');
                  codeInputRef.current[0].focus();
                }}
                className={'text-sm ' + !!code.length ? 'text-teal-500' : 'text-gray-500'}>
                {content.code.reset}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Checkbox
            label={content.reminders.label}
            checked={reminders}
            onChange={() => setReminders(!reminders)}
            description={<p className="text-xs leading-5 text-gray-500">{content.reminders.description}</p>}
          />
          <Checkbox
            label={
              <>
                {content.consent.label}
                <span className="font-normal"> ({content.required})</span>
              </>
            }
            checked={consent}
            onChange={() => setConsent(!consent)}
            description={
              <p className="text-xs leading-5 text-gray-500">
                {content.consent.description}
                <Link href="/privacy">
                  <a className="font-medium text-gray-900 underline">{content.consent.privacy}</a>
                </Link>
              </p>
            }
          />
        </div>

        <div className="mt-6">
          <span className="block w-full rounded-md shadow-sm">
            <button
              disabled={!codeIsComplete || !phoneIsValid}
              ref={btn => (submitBtnRef.current = btn)}
              onClick={e => {
                e.preventDefault();
                if (consent) {
                  verify(parsePhoneNumberFromString(phone).number, code, reminders, consent);
                } else {
                  setAuthError(content.consent.error);
                }
              }}
              className={
                'relative w-full flex justify-center py-2 px-4 bg-teal-500 border border-transparent text-sm font-medium h-10 rounded-md text-white focus:outline-none transition duration-150 ease-in-out ' +
                (phoneIsValid && codeIsComplete ? 'hover:bg-teal-600' : 'opacity-50 focus:shadow-none cursor-default')
              }>
              {verifying ? (
                <span className="absolute inset-0 h-full flex items-center justify-center text-lg">
                  <LoadingSpinner color="white" />
                </span>
              ) : (
                content.btn.label
              )}
            </button>
          </span>
          {authError && <p className="mt-2 text-xs font-normal text-red-600">{authError}</p>}
        </div>
      </div>
    </form>
  );
}
