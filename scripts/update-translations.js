/**
 * Downloads the official game content translations (character names,
 * abilities, night order texts, reminder tokens and jinxes) from
 * https://github.com/ThePandemoniumInstitute/botc-translations
 * and stores the parts this app uses in src/i18n/game/<locale>.json.
 *
 * Usage: npm run update-translations [-- <locale> ...]   (default: es)
 *
 * Review the result with `git diff` before committing. Your own corrections
 * belong in src/i18n/game/<locale>.overrides.json, which this script never
 * touches.
 */
const fs = require("fs");
const path = require("path");

const SOURCE =
  "https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-translations/main/game";
const TARGET_DIR = path.join(__dirname, "..", "src", "i18n", "game");
const ROLE_FIELDS = ["name", "ability", "first", "other"];

const sortKeys = (object) =>
  Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, object[key]]),
  );

const pick = (object, fields) =>
  Object.fromEntries(
    fields
      .filter((field) => object[field])
      .map((field) => [field, object[field]]),
  );

async function update(locale) {
  const url = `${SOURCE}/${locale}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} -> HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!data.roles || !data.reminders || !data.jinxes) {
    throw new Error(`${url} does not have the expected format`);
  }

  const roles = {};
  for (const [id, role] of Object.entries(data.roles)) {
    const texts = pick(role, ROLE_FIELDS);
    if (Object.keys(texts).length) roles[id] = texts;
  }
  const result = {
    roles: sortKeys(roles),
    reminders: sortKeys(data.reminders),
    jinxes: sortKeys(data.jinxes),
  };

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  const file = path.join(TARGET_DIR, `${locale}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
  console.log(
    `${locale}: ${Object.keys(result.roles).length} roles, ` +
      `${Object.keys(result.reminders).length} reminders, ` +
      `${Object.keys(result.jinxes).length} jinxes -> ${path.relative(
        process.cwd(),
        file,
      )}`,
  );
}

const locales = process.argv.slice(2);
(async () => {
  for (const locale of locales.length ? locales : ["es"]) {
    await update(locale);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
