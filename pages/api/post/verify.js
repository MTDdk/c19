import db from '../../../db';
import rollbar from '../../../rollbar';

const secret = process.env.SECRET;

export default async (req, res) => {
  try {
    if (req.method === 'POST') {
      const { phone, code, reminders, consent } = req.body;
      const { id } = await db.task(async t => {
        const person = await t.oneOrNone(
          `SELECT
            id,
            reminders,
            verified,
            primary_participant
          FROM person
          WHERE phoneHash = ENCODE(ENCRYPT($/phone/, $/secret/, 'bf'), 'base64')
            AND PGP_SYM_DECRYPT(code::bytea, $/secret/) = $/code/`,
          { phone, code, secret }
        );
        if (!person) return {};
        if (!person.verifed) {
          await t.none(`UPDATE person SET verified = true where id = $/id/`, { id: person.id });
        }
        if (!person.reminders && reminders) {
          await t.none(`UPDATE person SET reminders = true where id = $/id/`, { id: person.id });
        }
        if (!person.consent) {
          await t.none(`UPDATE person SET consent = true where id = $/id/`, { id: person.id });
        }
        let survey = await t.oneOrNone(
          `SELECT id
          FROM survey
          WHERE person = $/person/
            AND date = current_date
            ${person.primary_participant ? 'AND participant = $/primary_participant/' : ''}`,
          { person: person.id, primary_participant: person.primary_participant }
        );
        if (!survey) {
          survey = await t.oneOrNone(
            `INSERT INTO survey  (
                person,
                participant
              ) VALUES (
                $/person/,
                $/participant/
              )
              RETURNING id`,
            { person: person.id, participant: person.primary_participant }
          );
        }
        return { id: survey.id };
      });
      if (id) {
        res.json({ id });
      } else res.status(401).end();
    } else res.status(502).end();
  } catch (error) {
    console.error(error);
    rollbar.error(error);
    res.status(500).end();
  }
};
