const SZ = {
  names: ['Spieler 1', 'Spieler 2'],
  group: ['Anna', 'Ben', 'Clara', 'David'],
  games: [],
  activeCleanup: null
};

const $ = (tag, cls, html) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  return el;
};

const R = (n) => Math.floor(Math.random() * n);

const registerGame = (def) => {
  SZ.games.push(def);
};

(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('sz_profiles_v1') || 'null');
    if (saved) {
      if (Array.isArray(saved.names) && saved.names.length === 2) SZ.names = saved.names;
      if (Array.isArray(saved.group) && saved.group.length) SZ.group = saved.group;
    }
  } catch (_) {}
})();

const saveProfiles = () => {
  try {
    localStorage.setItem('sz_profiles_v1', JSON.stringify({
      names: SZ.names,
      group: SZ.group
    }));
  } catch (_) {}
};
