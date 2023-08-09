import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { formatDate } from '../utils/format';
import '../styles/library.css';
import '../styles/mail-link.css';

const TEXT = {
  decline: {
    title: 'Vormerkung freigeben',
    question: 'Du brauchst das Buch nicht mehr? Dann bekommt es die nächste Person auf der Warteliste.',
    button: 'Ja, freigeben',
    done: 'Danke! Das Buch geht jetzt an die nächste Person.'
  },
  reserve: {
    title: 'Noch einmal vormerken',
    question: 'Wir setzen dich wieder auf die Warteliste. Sobald ein Exemplar frei ist, bekommst du eine Mail.',
    button: 'Ja, vormerken',
    done: 'Du stehst wieder auf der Warteliste.'
  }
};

const REASONS = {
  'already reserved': 'Du hast das Buch schon vorgemerkt.',
  'reservation is cancelled': 'Die Vormerkung ist schon freigegeben.',
  'reservation is fulfilled': 'Du hast das Buch schon abgeholt.',
  'reservation is expired': 'Die Abholfrist ist schon abgelaufen.'
};

// /reservations/link/:token, opened from the links in the library mails. Works without login.
export default function ReservationLink() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/reservations/link/' + encodeURIComponent(token))
      .then(setInfo)
      .catch(err => setError(err.status === 410 ? 'Der Link ist nicht mehr gültig.' : err.message));
  }, [token]);

  function confirm() {
    setBusy(true);
    api.post('/reservations/link/' + encodeURIComponent(token))
      .then(setResult)
      .catch(err => setError(err.message))
      .finally(() => setBusy(false));
  }

  if (error) {
    return (
      <div className="mail-link">
        <div className="error">{error}</div>
        <p><Link to="/reservations">Zu meinen Vormerkungen</Link></p>
      </div>
    );
  }
  if (!info) return <div className="loading">Lade...</div>;

  const text = TEXT[info.action];
  return (
    <div className="mail-link">
      <h1>{text.title}</h1>
      <div className="mail-link__book">
        <img src={info.book.cover} alt="" />
        <div>
          <strong>{info.book.title}</strong>
          <div>{info.book.author}</div>
          <div className="mail-link__sub">Link gültig bis {formatDate(info.validUntil)}</div>
        </div>
      </div>

      {result ? (
        <div className="mail-link__done">
          {text.done}
          {result.reservation && result.reservation.position && (
            <div>Du bist auf Platz {result.reservation.position}.</div>
          )}
        </div>
      ) : info.possible ? (
        <>
          <p>{info.user && info.user.name ? 'Hallo ' + info.user.name + ', ' : ''}{text.question}</p>
          <button className="primary" disabled={busy} onClick={confirm}>{text.button}</button>
        </>
      ) : (
        <div className="mail-link__done">
          {REASONS[info.reason] || info.reason}
          {info.reservation && info.reservation.position && <div>Du bist auf Platz {info.reservation.position}.</div>}
        </div>
      )}

      <p className="mail-link__sub">
        <Link to={'/books/' + encodeURIComponent(info.book.isbn)}>Zum Buch</Link> &middot;{' '}
        <Link to="/reservations">Meine Vormerkungen</Link>
      </p>
    </div>
  );
}
