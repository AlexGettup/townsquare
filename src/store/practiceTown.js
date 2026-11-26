import i18n from "../i18n";
import { CHOICES, alignmentOf, describePart, partsOf } from "../cards";
import { knowledgeOf } from "../practiceBrain";
import {
  NOMINATE_AT,
  claimFor,
  condemnedOf,
  escapeOf,
  gossipStatement,
  isCarefulDay,
  isMayorStandoff,
  moonchildChoice,
  nominationOf,
  rollHunches,
  slayerShot,
  suspicionsOf,
  townOpinion,
  votesFor,
  wantsSwap,
} from "../practiceDay";
import { grimoireSeats } from "./modules/practice";
import { STORYTELLER } from "./modules/voice";
import { valueFromReminders } from "./voteValue";

// how likely a made-up player is to raise their hand in an exile
const EXILE_YES = 0.5;
// pauses, in ms: between people talking at dawn, before a nomination
const TALK_GAP = [2500, 5000];
const NOMINATE_GAP = [3000, 6000];
// the evil team's secrets, never told in the town square
const SECRET = ["youAre", "thisIsTheDemon", "theseAreYourMinions", "notInPlay"];
// lines that only ask something: what they learned is the rest of the line
const ASKS = [...CHOICES, "useAbility", "pointAtPlayer"];

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
 * - The Gossip may make a public statement, and the Moonchild chooses
 *   someone when they learn they died.
 * - At night, store.$practiceTown.viewOf() tells the cards window what a
 *   made-up player thinks, so they choose by it (src/practiceBrain.js).
 *
 * What each one thinks lives here, for this page load.
 */
export default (store) => {
  const isActive = () =>
    store.state.practice.active && !store.state.session.gameOver;
  const isAuto = () => isActive() && store.state.practice.auto;

  // player ID -> { day, hunches, claim, told, shot, gossiped, moonchild }
  let minds = {};
  // name -> role ID claimed in the town square
  let claims = {};
  // player ID -> the grimoire they were shown (the Spy): { players: [{
  // name, roleId, alignment }], bluffs: [role IDs] }
  let seen = {};
  // the storyteller's open call for nominations (an announcement key)
  let call = null;
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
    seen = {};
    call = null;
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
  const day = () => store.state.grimoire.nightCount || 1;
  const aliveCount = () =>
    store.state.players.players.filter(({ isDead }) => !isDead).length;

  // until: { playerId, messageId }, only that player's cards sent before
  // that one (the card they are answering now)
  const cardsOf = (playerId, until = null) =>
    store.state.chat.messages
      .filter(
        (message) =>
          message.channel === "dm:" + playerId &&
          message.from === STORYTELLER &&
          message.card &&
          !(
            until &&
            until.playerId === playerId &&
            message.id >= until.messageId
          ),
      )
      .map(({ card, choice }) => ({ card, choice }));

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

  /** Everyone as the made-up players see themselves, with what they think. */
  const town = (until = null) => {
    const seats = grimoireSeats(store.state.players.players);
    const people = seats.map((seat) => {
      const cards = cardsOf(seat.id, until);
      const me = withGrimoire(knowledgeOf(seat, cards, roleById), seat.id);
      const mind = minds[seat.id] || (minds[seat.id] = { told: 0 });
      if (mind.day !== day()) {
        mind.day = day();
        mind.hunches = rollHunches(me, seats);
      }
      const scores = suspicionsOf(me, {
        cards,
        players: seats,
        hunches: mind.hunches,
        claims,
        roleById,
      });
      return { seat, me, mind, cards, scores };
    });
    const opinion = townOpinion(
      people
        .filter(({ me }) => me.alignment !== "evil")
        .map(({ scores }) => scores),
    );
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
    };
  };
  store.$practiceTown = { viewOf };

  const say = (playerId, key, values = {}) => {
    if (typeof store.$chat.sayAs !== "function") return;
    store.$chat.sayAs(playerId, i18n.t(`practice.say.${key}`, values));
  };

  /** What they learned at night and haven't told yet, as one line. */
  const newsOf = ({ cards, mind }) => {
    let lastChoice = [];
    const lines = [];
    cards.forEach(({ card, choice }, index) => {
      partsOf(card).forEach((part) => {
        if (index < mind.told || SECRET.includes(part.phrase)) return;
        const info = ASKS.includes(part.phrase)
          ? { ...part, phrase: null }
          : part;
        const onlyNumber =
          !info.phrase &&
          info.number !== null &&
          !info.players.length &&
          !info.roles.length &&
          !info.answer;
        const line = onlyNumber
          ? i18n.t("practice.say.number", { n: info.number })
          : describePart(info, (key) => i18n.t(key), roleName);
        if (!line) return;
        // a yes or no about the players they chose (Fortune Teller)
        lines.push(
          part.answer && lastChoice.length && !part.players.length
            ? `${lastChoice.join(", ")}: ${line}`
            : line,
        );
      });
      if (choice && choice.length) lastChoice = choice;
    });
    mind.told = cards.length;
    return lines.join("; ");
  };

  /** Dawn: who speaks, one after the other. */
  const dawn = () => {
    const { people } = town();
    const speakers = people
      .filter(
        ({ mind }) =>
          Math.random() < (mind.claim ? 0.6 : day() > 1 ? 0.85 : 0.6),
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
          const alive = people
            .filter(({ seat }) => !seat.isDead)
            .map(({ seat }) => seat.name);
          const target = slayerShot(me, scores, { alive, day: day() });
          if (!target) return;
          mind.shot = true;
          claims[seat.name] = me.role.id;
          mind.claim = me.role.id;
          say(seat.id, "slayer", { role: roleName(me.role.id), name: target });
        });
        // the Gossip's statement, once a day
        people.forEach(({ seat, me, mind, scores }) => {
          if (seat.isDead || mind.gossiped === day()) return;
          const alive = people
            .filter(({ seat }) => !seat.isDead)
            .map(({ seat }) => seat.name);
          const target = gossipStatement(me, scores, { alive, day: day() });
          if (!target) return;
          mind.gossiped = day();
          claims[seat.name] = me.role.id;
          mind.claim = me.role.id;
          say(seat.id, "gossip", { role: roleName(me.role.id), name: target });
        });
      },
      wait + between(TALK_GAP),
    );
    // a Moonchild killed at night learns it now
    later(moonchildren, between(TALK_GAP));
  };

  /** Dead Moonchildren who haven't chosen yet choose someone, in public. */
  const moonchildren = () => {
    if (!isAuto() || store.state.grimoire.isNight) return;
    const { people, opinion } = town();
    const alive = people
      .filter(({ seat }) => !seat.isDead)
      .map(({ seat }) => seat.name);
    people.forEach(({ seat, me, mind, scores }) => {
      // brought back (Shabaloth, Professor): they choose again next time
      if (!seat.isDead) mind.moonchild = false;
      if (!seat.isDead || mind.moonchild) return;
      const target = moonchildChoice(me, scores, { alive, opinion });
      if (!target) return;
      mind.moonchild = true;
      claims[seat.name] = me.role.id;
      mind.claim = me.role.id;
      say(seat.id, "moonchild", { role: roleName(me.role.id), name: target });
    });
  };

  const speak = (playerId) => {
    if (!isAuto() || store.state.grimoire.isNight) return;
    const { people, opinion } = town();
    const person = people.find(({ seat }) => seat.id === playerId);
    if (!person) return;
    const { seat, me, mind, scores } = person;
    const isEvil = me.alignment === "evil";
    const first = !mind.claim;
    if (first) {
      mind.claim = claimFor(me, { scriptRoles: scriptRoles(), claims });
      if (!mind.claim) return;
      claims[seat.name] = mind.claim;
    }
    const news = isEvil ? "" : newsOf(person);
    const parts = [];
    if (first)
      parts.push(i18n.t("practice.say.claim", { role: roleName(mind.claim) }));
    if (news)
      parts.push(
        i18n.t(first ? "practice.say.learned" : "practice.say.lastNight", {
          info: news,
        }),
      );
    // nothing new: who they doubt most, if anyone (the evil, a good player)
    if (!news) {
      const doubted = Object.keys(scores)
        .filter(
          (name) => !people.find(({ seat }) => seat.name === name).seat.isDead,
        )
        .filter((name) => !isEvil || !me.teammates.includes(name))
        .sort(
          (a, b) =>
            (isEvil ? opinion[b] || 0 : scores[b]) -
            (isEvil ? opinion[a] || 0 : scores[a]),
        )[0];
      if (doubted && (isEvil || scores[doubted] > 0.8)) {
        parts.push(i18n.t("practice.say.suspect", { name: doubted }));
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
    if (escape.reason === "saint") {
      claims[condemned] = "saint";
      person.mind.claim = "saint";
    }
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
    const mood = town();
    const { people, opinion } = mood;
    const nominees = players.players
      .filter((player) => !player.wasNominated && !player.isDead)
      .map(({ name }) => name);
    if (tryEscape(mood, nominees) || !call) return;
    const hasBlock = !!store.getters["session/votesToBeat"];
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
          careful: isCarefulDay(
            people.map(({ seat }) => seat),
            claims,
          ),
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
    if (!wanted || wanted.eager < NOMINATE_AT[call] + today * 0.1) {
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
          careful,
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
        if (!state.session.nomination && isAuto()) {
          nominateSoon();
        }
        break;
      // someone died by day (executed): a Moonchild chooses at once
      case "players/update":
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
