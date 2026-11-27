import i18n from "../i18n";
import nightsheet from "../nightsheet.json";
import { CHOICES, alignmentOf, describePart } from "../cards";
import { knowledgeOf } from "../practiceBrain";
import {
  NOMINATE_AT,
  VORTOX_NOMINATE,
  answerAfter,
  artistQuestion,
  claimFor,
  condemnedOf,
  escapeOf,
  fakeInfo,
  gossipStatement,
  hidingChance,
  infoOf,
  isCarefulDay,
  isMayorStandoff,
  jugglerGuesses,
  klutzChoice,
  madnessIn,
  moonchildChoice,
  mostDoubted,
  nominationOf,
  publicOpinion,
  driftHunches,
  slayerShot,
  thinkOf,
  votesFor,
  wantsSwap,
} from "../practiceDay";
import {
  convictionFactor,
  rollConviction,
  rollPersonality,
  traitsOf,
} from "../practicePersonality";
import { dmTab } from "./modules/chat";
import { grimoireSeats } from "./modules/practice";
import { STORYTELLER } from "./modules/voice";
import { valueFromReminders } from "./voteValue";

// how likely a made-up player is to raise their hand in an exile
const EXILE_YES = 0.5;
// pauses, in ms: between people talking at dawn, before a nomination
const TALK_GAP = [2500, 5000];
const NOMINATE_GAP = [3000, 6000];
// lines that only ask something: what they learned is the rest of the line
const ASKS = [...CHOICES, "useAbility", "pointAtPlayer"];
// from how much doubt about their own info a good player says it (0 to 0.6)
const DOUBT_SAID = 0.2;

const between = ([min, max]) => min + Math.random() * (max - min);

/**
 * Store plugin for practice games by day, with "Automatic" on (see
 * src/practiceDay.js for how they think):
 *
 * - At dawn some made-up players say in the town square what they are and
 *   what they learned at night; the evil ones bluff. The Slayer may shoot.
 * - When the storyteller announces that nominations are open (and on the
 *   second and last call) the most convinced one nominates, then the next
 *   after each vote, while someone is sure enough.
 * - When the clock hand starts, each one votes from what they think.
 * - The Gossip may make a public statement, and the Moonchild and the Klutz
 *   choose someone when they learn they died.
 * - Sects & Violets: the Juggler guesses on day 1, the Savant visits the
 *   storyteller each day and the Artist asks one question (in the private
 *   chat), a player made mad by the Cerenovus claims that character, and
 *   with the Vortox on the script they want an execution every day.
 * - At night, store.$practiceTown.viewOf() tells the cards window what a
 *   made-up player thinks, so they choose by it (src/practiceBrain.js).
 *
 * What each one thinks lives here, for this page load.
 */
export default (store) => {
  const isActive = () =>
    store.state.practice.active && !store.state.session.gameOver;
  const isAuto = () => isActive() && store.state.practice.auto;

  // player ID -> { day, hunches, claim, ownRole, told, shot, gossiped,
  // moonchild, klutz, juggled, savant, artist: { name, from }, dawnCards,
  // mad: { day, roleId } }
  let minds = {};
  // name -> role ID claimed in the town square
  let claims = {};
  // what each one said they learned at night, true or made up: [{ speaker,
  // roleId, lines }] (lines as practiceDay's infoOf gives them)
  let statements = [];
  // who said "I suspect X" in the town square: [{ speaker, name }]
  let accusations = [];
  // who said on the first day they'd rather not say what they are (names)
  let hidden = [];
  // who died by day, and on which day: [{ name, day }] (the Undertaker's
  // made-up info)
  let executions = [];
  // deaths and comebacks as they happened: [{ name, at, isDead }], to know
  // who was alive when a card came (the Empath's neighbours that night)
  let deaths = [];
  // when each night fell and each nomination began: a night's info is
  // about the seats as they were up to the next one of these (deaths in
  // the night, marked then or at dawn, count; the day's executions don't)
  let cutoffs = [];
  // player ID -> the grimoire they were shown (the Spy): { players: [{
  // name, roleId, alignment }], bluffs: [role IDs] }
  let seen = {};
  // the storyteller's open call for nominations (an announcement key)
  let call = null;
  // the nomination going on or last made: { nominator, nominee, day,
  // first } (names), to see a Virgin's ability go off
  let lastNomination = null;
  // claimed Virgins already nominated once: her ability is spent (names)
  let tested = [];
  // a claimed Virgin whose nominator was executed at once: [{ virgin,
  // nominator, day }]
  let virginKills = [];
  const timers = new Set();
  // a nomination is on its way (said, about to be made): only one at a time
  let nominating = null;

  const later = (fn, ms) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };
  const cancelAll = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    if (nominating) clearTimeout(nominating);
    nominating = null;
    aboutToNominate = false;
  };
  // the next nomination attempt, replacing one already waiting
  let aboutToNominate = false;
  const nominateSoon = () => {
    if (aboutToNominate) return;
    if (nominating) clearTimeout(nominating);
    nominating = setTimeout(tryNominate, between(NOMINATE_GAP));
  };
  const forget = () => {
    cancelAll();
    minds = {};
    claims = {};
    statements = [];
    accusations = [];
    hidden = [];
    deaths = [];
    executions = [];
    cutoffs = [];
    seen = {};
    call = null;
    lastNomination = null;
    tested = [];
    virginKills = [];
  };

  const roleById = (id) =>
    store.state.roles.get(id) || store.getters.rolesJSONbyId.get(id) || null;
  const roleName = (id) => {
    const role = roleById(id);
    return role ? store.getters.localizeRole(role).name : id;
  };
  const scriptRoles = () =>
    [...store.state.roles.values()].filter(
      ({ team }) => team !== "traveller" && team !== "fabled",
    );
  const scriptIds = () => scriptRoles().map(({ id }) => id);
  // that character wakes at night (from the second night on: the other
  // nights' order), as far as the night order says
  const wakes = (id) =>
    (day() > 1 ? nightsheet.otherNight : nightsheet.firstNight).includes(id);
  const day = () => store.state.grimoire.nightCount || 1;
  // the Vortox on the script, and nobody about to die yet: no execution
  // today loses the game
  const mustExecute = () =>
    store.state.roles.has("vortox") &&
    !condemnedOf(store.getters["session/votesToBeat"]);
  const aliveCount = () =>
    store.state.players.players.filter(({ isDead }) => !isDead).length;

  // until: { playerId, messageId }, only that player's cards sent before
  // that one (the card they are answering now)
  const cardsOf = (playerId, until = null) =>
    store.state.chat.messages
      .filter(
        (message) =>
          message.channel === dmTab(playerId) &&
          message.from === STORYTELLER &&
          message.card &&
          !(
            until &&
            until.playerId === playerId &&
            message.id >= until.messageId
          ),
      )
      .map(({ card, choice, at }) => ({ card, choice, at }));

  /**
   * The seats as they were for info that came at that moment (who was
   * alive): up to the next nightfall or nomination after it.
   */
  const seatsAt = (at) => {
    const seats = store.state.players.players;
    const until = at && cutoffs.find((time) => time > at);
    if (!until || !deaths.length) return seats;
    return seats.map((seat) => {
      const changes = deaths.filter(({ name }) => name === seat.name);
      if (!changes.length) return seat;
      const before = changes.filter((change) => change.at <= until).pop();
      const isDead = before ? before.isDead : !changes[0].isDead;
      return { name: seat.name, isDead };
    });
  };

  /** Their personality's traits, rolled now if they have none yet. */
  const traitsFor = (playerId) => {
    let id = store.state.practice.personalities[playerId];
    if (!id) {
      id = rollPersonality();
      store.commit("practice/setPersonality", {
        id: playerId,
        personality: id,
      });
    }
    return traitsOf(id);
  };

  /** How convincing they are (1 to 10), rolled now if not yet. */
  const convictionFor = (playerId) => {
    let conviction = store.state.practice.convictions[playerId];
    if (!conviction) {
      conviction = rollConviction();
      store.commit("practice/setConviction", { id: playerId, conviction });
    }
    return conviction;
  };

  /**
   * The nominations of the last day before that moment, as the vote
   * history has them: [{ nominator, voters }] (the Flowergirl, the Town
   * Crier).
   */
  const dayVotes = (at) => {
    const before = store.state.session.voteHistory.filter(
      ({ timestamp }) => !at || new Date(timestamp).getTime() < at,
    );
    if (!before.length) return [];
    const last = before[before.length - 1].day;
    return before
      .filter(({ day }) => day === last)
      .map(({ nominator, votes }) => ({
        nominator,
        voters: votes.map((name) => name.replace(/^−/, "")),
      }));
  };

  /**
   * Who was executed (died by day after being nominated that day): the
   * other dead were killed at night (or by a Virgin), so good.
   */
  const executedNames = () =>
    executions
      .filter(({ name, day: when }) =>
        store.state.session.voteHistory.some(
          (entry) => entry.day === when && entry.nominee === name,
        ),
      )
      .map(({ name }) => name);

  /**
   * Every nomination of the game so far: [{ nominator, nominee, voters }]
   * (names).
   */
  const pastVotes = () =>
    store.state.session.voteHistory
      .filter(({ type }) => type !== "Exile")
      .map(({ nominator, nominee, votes }) => ({
        nominator,
        nominee,
        voters: votes.map((name) => name.replace(/^−/, "")),
      }));

  /**
   * An evil player who was shown the grimoire (the Spy) knows the whole
   * evil team, and can bluff a character that isn't in play.
   */
  const withGrimoire = (me, playerId) => {
    const grimoire = seen[playerId];
    if (!grimoire || me.alignment !== "evil") return me;
    const inPlay = grimoire.players.map(({ roleId }) => roleId);
    const notInPlay = scriptRoles()
      .filter(({ team, id }) => team === "townsfolk" && !inPlay.includes(id))
      .map(({ id }) => id);
    return {
      ...me,
      teammates: grimoire.players
        .filter(
          ({ alignment, name }) => alignment === "evil" && name !== me.name,
        )
        .map(({ name }) => name),
      demons: grimoire.players
        .filter(
          ({ roleId, name }) =>
            name !== me.name && (roleById(roleId) || {}).team === "demon",
        )
        .map(({ name }) => name),
      bluffs: [...new Set([...me.bluffs, ...grimoire.bluffs, ...notInPlay])],
    };
  };

  /** What a made-up player saw when shown the grimoire. */
  const remember = (playerId, grimoire) => {
    const { players } = store.state.players;
    seen[playerId] = {
      players: grimoire.players.map(({ roleId, alignmentIndex }, index) => {
        const role = roleById(roleId) || {};
        return {
          name: players[index] ? players[index].name : "",
          roleId,
          alignment: alignmentOf(role.team, alignmentIndex),
        };
      }),
      bluffs: (grimoire.bluffs || []).filter(Boolean),
    };
  };

  // the names of the alive ones among town()'s people
  const aliveNames = (people) =>
    people.filter(({ seat }) => !seat.isDead).map(({ seat }) => seat.name);
  // they say in public what they are (claims[name] = role ID)
  const claimAs = (seat, mind, roleId) => {
    claims[seat.name] = roleId;
    mind.claim = roleId;
  };

  /** Everyone as the made-up players see themselves, with what they think. */
  const town = (until = null) => {
    const seats = grimoireSeats(store.state.players.players);
    // how convincing each one is, by name
    const factors = {};
    seats.forEach(({ id, name }) => {
      factors[name] = convictionFactor(convictionFor(id));
    });
    const convictionOf = (name) => factors[name] || 1;
    const people = seats.map((seat) => {
      const cards = cardsOf(seat.id, until);
      const me = withGrimoire(knowledgeOf(seat, cards, roleById), seat.id);
      const mind = minds[seat.id] || (minds[seat.id] = { told: 0 });
      const traits = traitsFor(seat.id);
      if (mind.day !== day()) {
        mind.day = day();
        mind.hunches = driftHunches(
          me,
          seats,
          mind.hunches,
          Math.random,
          traits.hunch,
        );
      }
      const { scores, doubt, why } = thinkOf(me, {
        script: scriptIds(),
        cards,
        players: seats,
        hunches: mind.hunches,
        claims,
        roleById,
        statements,
        traits,
        seatsAt,
        day: day(),
        accusations,
        hidden,
        convictionOf,
        dayVotes,
        virginKills,
        pastVotes: pastVotes(),
        executed: executedNames(),
      });
      // the storyteller's answer to the Artist's question
      if (mind.artist && mind.artist.name in scores) {
        const answer = answerAfter(cards, mind.artist.from);
        if (answer) scores[mind.artist.name] += answer === "yes" ? 3 : -1.5;
      }
      return { seat, me, mind, cards, scores, traits, doubt, why };
    });
    // what the town square says: what the evil can read of the town
    const opinion = publicOpinion({
      script: scriptIds(),
      players: seats,
      claims,
      roleById,
      statements,
      seatsAt,
      day: day(),
      accusations,
      hidden,
      convictionOf,
      dayVotes,
      virginKills,
      pastVotes: pastVotes(),
      executed: executedNames(),
    });
    return { seats, people, opinion };
  };

  /**
   * What a made-up player knows and thinks, for the card they are answering
   * (messageId): { me, scores, opinion, claims }, or null.
   */
  const viewOf = (playerId, messageId) => {
    if (!isActive()) return null;
    const { people, opinion } = town({ playerId, messageId });
    const person = people.find(({ seat }) => seat.id === playerId);
    if (!person) return null;
    return {
      me: person.me,
      scores: person.scores,
      opinion,
      claims: { ...claims },
      traits: person.traits,
    };
  };
  store.$practiceTown = { viewOf };

  // a made-up player speaks in the town square, or writes to the
  // storyteller in private
  const say = (playerId, key, values = {}) => {
    if (typeof store.$chat.sayAs !== "function") return;
    store.$chat.sayAs(playerId, i18n.t(`practice.say.${key}`, values));
  };
  const write = (playerId, key, values = {}) => {
    if (typeof store.$chat.writeAs !== "function") return;
    store.$chat.writeAs(playerId, i18n.t(`practice.say.${key}`, values));
  };

  /** One line of night info written out, as a player would say it. */
  const lineText = (line) => {
    const info = ASKS.includes(line.phrase) ? { ...line, phrase: null } : line;
    // about the players they chose: a yes or no (Fortune Teller,
    // Seamstress), a number (Chambermaid) or characters (Dreamer)
    const about =
      !info.phrase &&
      line.about &&
      line.about.length &&
      !info.players.length &&
      (info.answer || info.number !== null || info.roles.length);
    const onlyNumber =
      !about &&
      !info.phrase &&
      info.number !== null &&
      !info.players.length &&
      !info.roles.length &&
      !info.answer;
    const text = onlyNumber
      ? i18n.t("practice.say.number", { n: info.number })
      : describePart(info, (key) => i18n.t(key), roleName);
    if (!text) return "";
    return about ? `${line.about.join(", ")}: ${text}` : text;
  };

  /**
   * What they learned at night and haven't told yet: { lines, text } (text
   * as one line, "" when nothing).
   */
  const newsOf = ({ seat, cards, mind }) => {
    const all = infoOf(seat.name, cards, seatsAt);
    const lines = all.slice(mind.told).filter((line) => lineText(line));
    mind.told = all.length;
    return { lines, text: lines.map(lineText).join("; ") };
  };

  /** Dawn: who speaks, one after the other. */
  const dawn = () => {
    const { people } = town();
    // made mad last night (the Cerenovus): they say it today
    people.forEach(({ mind, cards }) => {
      const mad = madnessIn(cards.slice(mind.dawnCards || 0));
      mind.dawnCards = cards.length;
      if (mad) mind.mad = { day: day(), roleId: mad };
    });
    const isMad = (mind) => !!mind.mad && mind.mad.day === day();
    const speakers = people
      .filter(
        ({ mind, traits }) =>
          isMad(mind) ||
          Math.random() <
            Math.min(
              (mind.claim ? 0.6 : day() > 1 ? 0.85 : 0.6) * traits.talk,
              0.95,
            ),
      )
      .sort(() => Math.random() - 0.5);
    let wait = between(TALK_GAP);
    speakers.forEach(({ seat }) => {
      later(() => speak(seat.id), wait);
      wait += between(TALK_GAP);
    });
    // the Slayer, once they've heard the others
    later(
      () => {
        if (!isAuto() || store.state.grimoire.isNight) return;
        const { people } = town();
        people.forEach(({ seat, me, mind, scores }) => {
          if (mind.shot || seat.isDead) return;
          const alive = aliveNames(people);
          const target = slayerShot(me, scores, { alive, day: day() });
          if (!target) return;
          mind.shot = true;
          claimAs(seat, mind, me.role.id);
          say(seat.id, "slayer", { role: roleName(me.role.id), name: target });
        });
        // the Gossip's statement, once a day
        people.forEach(({ seat, me, mind, scores }) => {
          if (seat.isDead || mind.gossiped === day()) return;
          const alive = aliveNames(people);
          const target = gossipStatement(me, scores, { alive, day: day() });
          if (!target) return;
          mind.gossiped = day();
          claimAs(seat, mind, me.role.id);
          say(seat.id, "gossip", { role: roleName(me.role.id), name: target });
        });
        sectsAndViolets(people);
      },
      wait + between(TALK_GAP),
    );
    // a Moonchild killed at night learns it now
    later(moonchildren, between(TALK_GAP));
  };

  /**
   * Day abilities of Sects & Violets, once the others have spoken: the
   * Juggler's guesses (day 1), the Savant's visit (each day), the Artist's
   * question (once). Only good players with the real character.
   */
  const sectsAndViolets = (people) => {
    const alive = aliveNames(people);
    people.forEach(({ seat, me, mind, scores, cards }) => {
      if (seat.isDead || me.alignment !== "good") return;
      const role = roleName(me.role.id);
      if (me.role.id === "juggler" && day() === 1 && !mind.juggled) {
        mind.juggled = true;
        const guesses = jugglerGuesses(me, scores, {
          alive,
          claims,
          scriptRoles: scriptRoles(),
        });
        if (!guesses) return;
        claimAs(seat, mind, me.role.id);
        say(seat.id, "juggler", {
          role,
          guesses: guesses
            .map(({ name, roleId }) =>
              i18n.t("practice.say.pair", { name, role: roleName(roleId) }),
            )
            .join(" "),
        });
      }
      if (me.role.id === "savant" && mind.savant !== day()) {
        mind.savant = day();
        write(seat.id, "savant", { role });
      }
      if (me.role.id === "artist" && !mind.artist) {
        const name = artistQuestion(me, scores, { alive, day: day() });
        if (!name) return;
        mind.artist = { name, from: cards.length };
        write(seat.id, "artist", { role, name });
      }
    });
  };

  /**
   * Dead Moonchildren and Klutzes who haven't chosen yet choose someone, in
   * public.
   */
  const moonchildren = () => {
    if (!isAuto() || store.state.grimoire.isNight) return;
    const { people, opinion } = town();
    const alive = aliveNames(people);
    people.forEach(({ seat, me, mind, scores }) => {
      // brought back (Shabaloth, Professor): they choose again next time
      if (!seat.isDead) mind.moonchild = mind.klutz = false;
      if (!seat.isDead) return;
      // the Klutz: if they choose an evil player, their team loses
      const klutz = !mind.klutz && klutzChoice(me, scores, { alive });
      if (klutz) {
        mind.klutz = true;
        claimAs(seat, mind, me.role.id);
        say(seat.id, "klutz", { role: roleName(me.role.id), name: klutz });
      }
      if (mind.moonchild) return;
      const target = moonchildChoice(me, scores, { alive, opinion });
      if (!target) return;
      mind.moonchild = true;
      claimAs(seat, mind, me.role.id);
      say(seat.id, "moonchild", { role: roleName(me.role.id), name: target });
    });
  };

  const speak = (playerId) => {
    if (!isAuto() || store.state.grimoire.isNight) return;
    const { people, opinion } = town();
    const person = people.find(({ seat }) => seat.id === playerId);
    if (!person) return;
    const { seat, me, mind, scores, traits } = person;
    const isEvil = me.alignment === "evil";
    // mad about a character today (the Cerenovus): they claim it and say
    // nothing else, or might be executed
    if (mind.mad && mind.mad.day === day()) {
      if (mind.claim === mind.mad.roleId) return;
      claimAs(seat, mind, mind.mad.roleId);
      say(seat.id, "claim", { role: roleName(mind.claim) });
      return;
    }
    // a good player whose character changed (Pit-Hag, Snake Charmer) says
    // the new one
    const changed =
      !isEvil && mind.ownRole && me.role.id && mind.ownRole !== me.role.id;
    const first = !mind.claim || changed;
    // some good players keep their character to themselves on the first day
    // (their personality's hides, more with a character the Demon would
    // kill first): they say so, and tell it all later
    if (first && !isEvil && !changed && day() === 1 && !mind.hid) {
      mind.hid = true;
      if (Math.random() < hidingChance(me.role.id, traits)) {
        hidden.push(seat.name);
        say(seat.id, "hiding");
        return;
      }
    }
    if (first) {
      mind.ownRole = me.role.id;
      mind.claim = claimFor(me, {
        scriptRoles: scriptRoles(),
        claims,
        traits,
      });
      if (!mind.claim) return;
      claims[seat.name] = mind.claim;
    }
    // what they learned, or for the evil what they make up for their bluff
    let told = { lines: [], text: "" };
    if (!isEvil) told = newsOf(person);
    else if (mind.faked !== day()) {
      mind.faked = day();
      // executed yesterday: died by day after being nominated that day
      const nominees = store.state.session.voteHistory
        .filter((entry) => entry.day === day() - 1)
        .map(({ nominee }) => nominee);
      const executed = executions.filter(
        ({ name, day: when }) => when === day() - 1 && nominees.includes(name),
      );
      const lines =
        fakeInfo(me, mind.claim, {
          players: store.state.players.players,
          claims,
          opinion,
          scriptRoles: scriptRoles(),
          day: day(),
          votes: dayVotes(),
          executed: executed.length ? executed[executed.length - 1].name : null,
          wakes,
          told: mind.fakedFor === mind.claim,
          traits,
        }) || [];
      if (lines.length) mind.fakedFor = mind.claim;
      told = { lines, text: lines.map(lineText).filter(Boolean).join("; ") };
    }
    if (told.lines.length) {
      statements.push({
        speaker: seat.name,
        roleId: mind.claim,
        lines: told.lines,
      });
    }
    const news = told.text;
    const parts = [];
    if (first)
      parts.push(i18n.t("practice.say.claim", { role: roleName(mind.claim) }));
    if (news)
      parts.push(
        i18n.t(first ? "practice.say.learned" : "practice.say.lastNight", {
          info: news,
        }),
      );
    // a careful good player who may be poisoned or drunk says so, once a day
    if (
      news &&
      !isEvil &&
      person.doubt >= DOUBT_SAID &&
      mind.doubted !== day()
    ) {
      mind.doubted = day();
      parts.push(
        i18n.t(
          person.why === "clash"
            ? "practice.say.infoClashes"
            : "practice.say.mayBePoisoned",
        ),
      );
    }
    // nothing new: who they doubt most, if anyone (the evil, a good player)
    if (!news) {
      const alive = aliveNames(people);
      const doubted = mostDoubted(
        Object.keys(scores).filter(
          (name) =>
            alive.includes(name) && (!isEvil || !me.teammates.includes(name)),
        ),
        isEvil ? opinion : scores,
      );
      if (doubted && (isEvil || scores[doubted] > 0.8)) {
        parts.push(i18n.t("practice.say.suspect", { name: doubted }));
        accusations.push({ speaker: seat.name, name: doubted });
      } else if (first) {
        parts.push(i18n.t("practice.say.nothingYet"));
      }
    }
    if (parts.length && typeof store.$chat.sayAs === "function") {
      store.$chat.sayAs(seat.id, parts.join(" "));
    }
  };

  /** Nominate now: say why, then the nomination itself a moment later. */
  const nominate = (playerId, target, key, values) => {
    say(playerId, key, { name: target, ...values });
    aboutToNominate = true;
    nominating = setTimeout(() => {
      nominating = null;
      aboutToNominate = false;
      if (!isAuto() || store.state.session.nomination) return;
      const seats = store.state.players.players;
      const from = seats.findIndex(({ id }) => id === playerId);
      const to = seats.findIndex(({ name }) => name === target);
      if (from < 0 || to < 0 || seats[to].wasNominated) return;
      if (seats[from].hasNominated) return;
      store.dispatch("session/nominate", [from, to]);
    }, 1500);
  };

  /**
   * Whoever is about to die, if their death loses the game for their team
   * and they haven't nominated today, nominates to get off the block.
   */
  const tryEscape = ({ people, opinion }, nominees) => {
    const condemned = condemnedOf(store.getters["session/votesToBeat"]);
    if (!condemned) return false;
    const person = people.find(({ seat }) => seat.name === condemned);
    const player =
      person &&
      store.state.players.players.find(({ id }) => id === person.seat.id);
    if (!player || player.isDead || player.hasNominated) return false;
    const escape = escapeOf(person.me, person.scores, {
      condemned,
      nominees,
      opinion,
      alive: aliveCount(),
    });
    if (!escape) return false;
    // the Saint says what they are: the good should want them off too
    if (escape.reason === "saint") claimAs(person.seat, person.mind, "saint");
    nominate(person.seat.id, escape.target, `escape.${escape.reason}`, {
      role: roleName(person.me.role.id),
    });
    return true;
  };

  /** The most convinced player nominates, if they are sure enough. */
  const tryNominate = () => {
    nominating = null;
    const { session, grimoire, players } = store.state;
    if (!isAuto() || grimoire.isNight || session.nomination) return;
    // the Virgin's nominator was executed: no more nominations today
    if (virginKills.some((kill) => kill.day === day())) return;
    const mood = town();
    const { people, opinion } = mood;
    const nominees = players.players
      .filter((player) => !player.wasNominated && !player.isDead)
      .map(({ name }) => name);
    if (tryEscape(mood, nominees) || !call) return;
    const hasBlock = !!store.getters["session/votesToBeat"];
    const vortox = mustExecute();
    const wanted = people
      .filter(({ seat }) => {
        const player = players.players.find(({ id }) => id === seat.id);
        return player && !player.isDead && !player.hasNominated;
      })
      .map((person) => ({
        person,
        nomination: nominationOf(person.me, person.scores, {
          nominees,
          opinion,
          claims,
          hasBlock,
          careful:
            !vortox &&
            isCarefulDay(
              people.map(({ seat }) => seat),
              claims,
            ),
          traits: person.traits,
          day: day(),
          hunches: person.mind.hunches,
          tested,
        }),
      }))
      .filter(({ nomination }) => nomination)
      .map((wish) => ({
        ...wish,
        eager: wish.nomination.score + Math.random() * 0.3,
      }))
      .sort((a, b) => b.eager - a.eager)[0];
    // each nomination today makes the next one a little harder
    const today = players.players.filter(
      (player) => player.hasNominated,
    ).length;
    const needed =
      vortox && call === "lastCall"
        ? VORTOX_NOMINATE
        : NOMINATE_AT[call] + today * 0.1;
    if (!wanted || wanted.eager < needed) {
      // nobody is sure enough: until the storyteller calls again
      call = null;
      return;
    }
    const { person, nomination } = wanted;
    const reason =
      nomination.reason === "sacrifice" ? "hunch" : nomination.reason;
    nominate(person.seat.id, nomination.target, `nominate.${reason}`, {
      role: roleName(person.me.role.id),
    });
  };

  /** The clock hand starts: everyone raises a hand or not. */
  const vote = () => {
    const { players } = store.state.players;
    const { nomination } = store.state.session;
    if (!nomination) return;
    const nominee = players[nomination[1]];
    const nominator = players[nomination[0]];
    const isExile = !!nominee && nominee.role.team === "traveller";
    const { people, opinion } = town();
    const mayor = isMayorStandoff(
      people.map(({ seat }) => seat),
      claims,
    );
    const careful = isCarefulDay(
      people.map(({ seat }) => seat),
      claims,
    );
    const condemned = condemnedOf(store.getters["session/votesToBeat"]);
    const vortox = mustExecute();
    const alive = aliveCount();
    const counts = {};
    const decide = (player, index) => {
      const canVote = !player.isVoteless || isExile;
      // the vote costs them their ghost vote (not in an exile, nor for a
      // Banshee with her ability)
      const spendsGhostVote =
        player.isDead && !isExile && valueFromReminders(player.reminders) !== 2;
      const person = people.find(({ seat }) => seat.id === player.id);
      let yes = false;
      if (canVote && isExile) yes = Math.random() < EXILE_YES;
      else if (canVote && person) {
        yes = votesFor(person.me, person.scores, {
          nominee: nominee && nominee.name,
          nominator: nominator && nominator.name,
          dead: spendsGhostVote,
          opinion,
          mayor,
          careful: careful && !vortox,
          mustExecute: vortox,
          traits: person.traits,
          swap: wantsSwap(person.me, person.scores, {
            condemned,
            claims,
            alive,
          }),
        });
        // the Butler only votes if their master does
        const master = butlerMaster(person.me);
        if (yes && master !== null) {
          const seat = players.findIndex(({ name }) => name === master);
          yes = seat >= 0 && counts[seat] > 0;
        }
      }
      counts[index] = yes ? (player.hasTwoVotes ? 2 : 1) : 0;
    };
    const isButler = (player) => {
      const person = people.find(({ seat }) => seat.id === player.id);
      return !!person && butlerMaster(person.me) !== null;
    };
    players.forEach((player, index) => {
      if (!isButler(player)) decide(player, index);
    });
    players.forEach((player, index) => {
      if (isButler(player)) decide(player, index);
    });
    players.forEach((player, index) => {
      if (store.state.session.votes[index] !== counts[index]) {
        store.commit("session/voteSync", [index, counts[index]]);
      }
    });
  };

  /** A Butler's master (the last player they chose), or null if none yet. */
  const butlerMaster = (me) => {
    if (me.role.id !== "butler") return null;
    const chosen = me.choices.filter(({ phrase }) => phrase === "choosePlayer");
    return chosen.length ? chosen[chosen.length - 1].choice[0] : null;
  };

  /**
   * Someone died by day: the nominator of a claimed Virgin, in her first
   * nomination and before any vote on it, was executed by her ability.
   */
  const virginKilled = (name, state) => {
    const last = lastNomination;
    if (!last || last.day !== day() || last.nominator !== name) return;
    if (claims[last.nominee] !== "virgin" || !last.first) return;
    const voted = state.session.voteHistory.some(
      (entry) =>
        entry.nominator === last.nominator && entry.nominee === last.nominee,
    );
    if (voted) return;
    virginKills.push({
      virgin: last.nominee,
      nominator: last.nominator,
      day: day(),
    });
    call = null;
    // someone in the town square says it out loud
    if (!isAuto()) return;
    later(() => {
      const { people } = town();
      const speakers = people.filter(
        ({ seat }) =>
          !seat.isDead && ![last.nominee, last.nominator].includes(seat.name),
      );
      if (!speakers.length) return;
      const speaker = speakers[Math.floor(Math.random() * speakers.length)];
      say(speaker.seat.id, "virginProven", {
        name: last.nominee,
        role: roleName("virgin"),
      });
    }, between(TALK_GAP));
  };

  store.subscribe(({ type, payload }, state) => {
    if (type === "practice/setActive" && !payload) forget();
    if (!isActive()) return;
    switch (type) {
      // the grimoire shown to a made-up player (the Spy)
      case "session/setGrimoireView":
        if (payload && payload.status === "sent" && payload.playerId) {
          remember(
            payload.playerId,
            payload.grimoire || store.getters["session/grimoireSnapshot"],
          );
        }
        break;
      case "toggleNight":
        if (state.grimoire.isNight) cutoffs.push(Date.now());
        cancelAll();
        call = null;
        if (!state.grimoire.isNight && isAuto() && state.grimoire.nightCount)
          dawn();
        break;
      case "session/setAnnouncement":
        if (payload && NOMINATE_AT[payload.key] && isAuto()) {
          call = payload.key;
          nominateSoon();
        }
        break;
      // a vote is over: the next one may nominate
      // (whoever is about to die may try to get off the block)
      case "session/nomination":
        if (state.session.nomination) {
          cutoffs.push(Date.now());
          const [from, to] = state.session.nomination;
          const seats = state.players.players;
          if (seats[from] && seats[to]) {
            const nominee = seats[to].name;
            lastNomination = {
              nominator: seats[from].name,
              nominee,
              day: day(),
              // her first nomination: only this one can set her ability off
              first: !tested.includes(nominee),
            };
            if (claims[nominee] === "virgin" && !tested.includes(nominee)) {
              tested.push(nominee);
            }
          }
        }
        if (!state.session.nomination && isAuto()) {
          nominateSoon();
        }
        break;
      case "players/update":
        // who was alive when: the Empath's neighbours on each night
        if (payload && payload.property === "isDead" && payload.player) {
          deaths.push({
            name: payload.player.name,
            at: Date.now(),
            isDead: !!payload.value,
          });
        }
        if (
          payload &&
          payload.property === "isDead" &&
          payload.value &&
          !state.grimoire.isNight
        ) {
          executions.push({ name: payload.player.name, day: day() });
          virginKilled(payload.player.name, state);
        }
        // someone died by day (executed): a Moonchild chooses at once
        if (
          payload &&
          payload.property === "isDead" &&
          payload.value &&
          isAuto() &&
          !state.grimoire.isNight
        ) {
          later(moonchildren, between(TALK_GAP));
        }
        break;
      case "session/lockVote":
        if (state.session.lockedVote === 1) vote();
        break;
      case "practice/setAuto":
        if (!payload) {
          cancelAll();
          call = null;
        }
        break;
      case "session/newGame":
      case "session/setGameOver":
        if (type === "session/newGame" || payload) forget();
        break;
    }
  });
};
