// Создаём объект-описание скрипта
let MyScript = {};

// Добавляем пункт в меню
const root = ['Custom Scripts', 'Information', 'Enemy Spells Radiuses'];

let enabled = Menu.AddToggle(root, 'Enable', false)
  .SetNameLocale('ru', 'Включить')
  .SetTip('Выделите вражеского героя и нажмите колесико мыши на способность, что бы отобразить ее радиус', 'ru')
  .OnChange(state => {
    enabled = state.newValue;
  })
  .GetValue();

let DistanceRadius = Menu.AddSlider(root, 'Distance', 0, 20000, 6769, 200)
  .SetNameLocale('ru', 'Дистанция')
  .SetTip('При превышении указаной дистанции радиус исчезает', 'ru')
  .OnChange(state => {
    DistanceRadius = state.newValue;
  })
  .GetValue();

let enabled_cd = Menu.AddToggle(root, 'Dublicate Call Dawn On Radius', true)
  .SetNameLocale('ru', 'Дублировать кд выбранной способности на радиусе')
  .OnChange(state => {
    enabled_cd = state.newValue;
  })
  .GetValue();

let x_offs = Menu.AddSlider(root, 'x_offset', -100, 100, 0, 1)
  .OnChange(state => {
    x_offs = state.newValue;
  })
  .GetValue();

let y_offs = Menu.AddSlider(root, 'y_offset', -100, 100, 0, 1)
  .OnChange(state => {
    y_offs = state.newValue;
  })
  .GetValue();

// Загрузка шрифта (делается один раз)
const font = Renderer.LoadFont('Comic Sans MS', 24, Enum.FontWeight.NORMAL);

let Panorama_Ability_Array_pos_size = [];
let Selected_Enemy = null;
let heroesData = {};

// Коллбэк: вызывается каждый игровой тик (~30 раз/сек)
MyScript.OnUpdate = () => {
  if (!enabled) return;

  let LocalHero = EntitySystem.GetLocalHero();
  if (!LocalHero) return;

  let LocalHeroPosition = LocalHero.GetAbsOrigin();

  // let HeroesList = EntitySystem.GetHeroesList()
  let EnemyHeroesList = EntitySystem.GetHeroesList().filter(hero =>
    !hero.IsDormant() &&
    hero.IsAlive() &&
    !hero.IsSameTeam(LocalHero) &&
    !hero.IsIllusion()
    // && hero.GetAbsOrigin().Distance(LocalHeroPosition) <= DistanceRadius
  );

  let Selected_Enemy_Spells_list;
  let Selected_Enemy_Position;
  let Selected_Enemy_Spells_list_Displayed = [];
  let Panorama_Ability_Array = [];

  if (
    Selected_Enemy &&
    (
      !Selected_Enemy.IsAlive() ||
      Selected_Enemy.IsDormant() ||
      Selected_Enemy.IsIllusion() ||
      Selected_Enemy.IsSameTeam(LocalHero)
    )
  ) {
    Selected_Enemy = null;
  }

  if (Selected_Enemy) {
    Selected_Enemy_Spells_list = Selected_Enemy.GetAbilities();

    for (let i of Selected_Enemy_Spells_list) {
      if (i.IsDisplayed() && !i.IsTalent() && !i.IsAttributes() && !i.IsInnate()) {
        Selected_Enemy_Spells_list_Displayed.push(i);
      }
    }

    Selected_Enemy_Position = Selected_Enemy.GetAbsOrigin();
  }

  Panorama_Ability_Array_pos_size = [];

  for (let i = 0; i < Selected_Enemy_Spells_list_Displayed.length; i++) {
    let ab = 'Ability' + i;
    Panorama_Ability_Array.push(Panorama.FindByName(ab));
  }

  Panorama_Ability_Array.forEach((panel, i) => {
    print(panel);

    if (panel && panel.IsValid()) {
      let pos = panel.GetPosition();
      let size = panel.GetSize();

      let posArr = String(pos).split(',').map(Number);
      let sizeArr = String(size).split(',').map(Number);

      Panorama_Ability_Array_pos_size.push(posArr[0], posArr[1], sizeArr[0], sizeArr[1]);
    }
  });

  if (Selected_Enemy) {
    const enemyIndex = Selected_Enemy.GetIndex();

    for (let i = 0; i < Panorama_Ability_Array_pos_size.length; i += 4) {
      let x = Panorama_Ability_Array_pos_size[i];
      let y = Panorama_Ability_Array_pos_size[i + 1];
      let w = Panorama_Ability_Array_pos_size[i + 2];
      let h = Panorama_Ability_Array_pos_size[i + 3];

      let IsHovering = Input.IsCursorInRect(x, y, w, h);
      print({ IsHovering });

      if (IsHovering && Input.IsKeyDownOnce(Enum.ButtonCode.MOUSE_MIDDLE)) {
        const spell = Selected_Enemy_Spells_list_Displayed[i / 4];
        const radius = spell.GetAOERadius() || spell.GetCastRange();

        if (!heroesData[enemyIndex]) {
          heroesData[enemyIndex] = {
            current_spell_choise: null,
            dota_spell_radius: 0,
            position: null,
            particle: null,
            dota_spell: null,
          };
        }

        if (heroesData[enemyIndex] && heroesData[enemyIndex].particle) {
          heroesData[enemyIndex].particle.Destroy();
          heroesData[enemyIndex].particle = null;
        } else {
          heroesData[enemyIndex].current_spell_choise = i / 4;
          heroesData[enemyIndex].dota_spell_radius = radius;
          heroesData[enemyIndex].position = Selected_Enemy_Position;
          heroesData[enemyIndex].particle = Particle.CreateCircle(null, Selected_Enemy, heroesData[enemyIndex].dota_spell_radius);
          heroesData[enemyIndex].dota_spell = spell;
        }
      }
    }
  }

  for (let enemyIndex in heroesData) {
    let data = heroesData[enemyIndex];
    if (!data || !data.particle) continue;

    let enemy = EntitySystem.GetByIndex(Number(enemyIndex));
    if (!enemy) continue;

    let distance = LocalHeroPosition.Distance2D(enemy.GetAbsOrigin());
    if (distance > DistanceRadius) {
      data.particle.Destroy();
      data.particle = null;
    }
  }

  print(Selected_Enemy);
  print(Selected_Enemy_Spells_list_Displayed.length);
};

MyScript.OnKeyEvent = event => {
  if (!enabled) return;
  if (event.key !== Enum.ButtonCode.MOUSE_LEFT || event.event !== Enum.KeyEvent.KEY_UP) return;

  const localHero = EntitySystem.GetLocalHero();
  if (!localHero) {
    Selected_Enemy = null;
    return;
  }

  const hovered = Input.GetHoveredEntity();
  if (!hovered) {
    return; // click on ground/minimap: keep current selected enemy
  }

  if (hovered.IsHero() && hovered.IsAlive() && !hovered.IsSameTeam(localHero) && !hovered.IsIllusion()) {
    Selected_Enemy = hovered;
  } else {
    Selected_Enemy = null; // clicked self/ally/other unit
  }
};

MyScript.OnPrepareUnitOrders = () => {
  if (!enabled) return;

  // Any real order (move/attack/spell/etc.) clears selected enemy, as requested.
  Selected_Enemy = null;
};

// Коллбэк: вызывается каждый кадр (60+ раз/сек) — только рисование!
MyScript.OnDraw = () => {
  if (!enabled_cd) return;
  if (!enabled) return;

  for (let enemyIndex in heroesData) {
    let data = heroesData[enemyIndex];
    if (!data || !data.particle || !data.dota_spell) continue;

    let enemy = EntitySystem.GetByIndex(Number(enemyIndex));
    if (!enemy) continue;

    let cd = data.dota_spell.GetCooldown();
    if (cd === 0) continue;

    let LocalHeroPosition = EntitySystem.GetLocalHero().GetAbsOrigin();

    let enemyPos = enemy.GetAbsOrigin();
    let dx = LocalHeroPosition.x - enemyPos.x;
    let dy = LocalHeroPosition.y - enemyPos.y;
    let len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;

    let textPos = new Vector(
      enemyPos.x + (dx / len) * data.dota_spell_radius,
      enemyPos.y + (dy / len) * data.dota_spell_radius,
      enemyPos.z
    );

    let screen = Renderer.WorldToScreen(textPos);
    if (!screen || !screen[2]) continue;

    Renderer.SetDrawColor(Color.GREEN);
    Renderer.DrawText(font, screen[0] + x_offs, screen[1] + y_offs, String(cd.toFixed(1)));
  }
};

// Регистрируем скрипт — это ОБЯЗАТЕЛЬНО!
RegisterScript(MyScript, 'draw spell radius');

// нейросетевое
Ability.prototype.IsInnate = function () {
  const innateStartLevel = this.GetAbilityDefinitionProperty('AbilityInnateStartLevel');
  if (innateStartLevel !== null && innateStartLevel !== undefined) {
    return Number(innateStartLevel) > 0;
  }

  return (
    !this.IsTalent() &&
    !this.IsAttributes() &&
    (this.GetBehavior() & Enum.AbilityBehavior.DOTA_ABILITY_BEHAVIOR_NOT_LEARNABLE) !== 0n
  );
};
