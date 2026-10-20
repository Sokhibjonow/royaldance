/*
 * build-wedding-comp.jsx — собирает в Adobe After Effects проект финальной
 * сборки свадебного 3D-приглашения поверх отрендеренного ролика.
 *
 * Как запустить: After Effects → File → Scripts → Run Script File… →
 * выбрать этот файл → указать invitation-hd.mp4 (и при желании music.mp3).
 *
 * Что создаётся (всё — стандартные эффекты AE, без плагинов):
 *   • композиция 1080×1920, 30 fps, 36 с, папки проекта
 *   • маркеры всех сцен
 *   • 3D-рендер как основной слой + цветокоррекция (Curves, Hue/Saturation)
 *   • мягкое свечение светов (Glow), «бархатный» диффузный блюр (Screen)
 *   • засветки-лайтлики на переходах (Fractal Noise + Screen)
 *   • частицы: пыль в лучах и лепестки (CC Particle World)
 *   • виньетка (маска с растушёвкой), плёночное зерно (Add Grain)
 *   • ручная «операторская» камера (wiggle на нуле)
 *   • направляющие подписи сцен (guide-слои, в рендер не попадают)
 */
(function () {
  app.beginUndoGroup("Wedding invitation — build comp");

  var W = 1080, H = 1920, FPS = 30, DUR = 36;
  var proj = app.project || app.newProject();

  function folder(name, parent) {
    var f = proj.items.addFolder(name);
    if (parent) f.parentFolder = parent;
    return f;
  }
  function fx(layer, matchName, name) {
    var e = layer.property("ADBE Effect Parade").addProperty(matchName);
    if (name) e.name = name;
    return e;
  }
  function setIf(effect, propName, value) {
    try { effect.property(propName).setValue(value); } catch (e) {}
  }

  var root = folder("Свадебное приглашение");
  var fFoot = folder("01 Рендер 3D", root);
  var fAudio = folder("02 Музыка", root);
  var fComps = folder("03 Композиции", root);

  var video = File.openDialog("Выберите отрендеренный ролик (invitation-hd.mp4)", "*.mp4;*.mov");
  if (!video) { alert("Ролик не выбран."); app.endUndoGroup(); return; }
  var footage = proj.importFile(new ImportOptions(video));
  footage.parentFolder = fFoot;

  var music = File.openDialog("Музыка (необязательно, Отмена — без музыки)", "*.mp3;*.wav;*.m4a");
  var musicItem = null;
  if (music) { musicItem = proj.importFile(new ImportOptions(music)); musicItem.parentFolder = fAudio; }

  var comp = proj.items.addComp("MAIN · Приглашение 1080×1920", W, H, 1, DUR, FPS);
  comp.parentFolder = fComps;
  comp.bgColor = [0.93, 0.9, 0.86];

  // --- scene markers ----------------------------------------------------
  var scenes = [
    [0.0, "Закрытая открытка · печать"], [1.6, "Бант распускается"], [3.6, "Створки и клапаны"],
    [6.0, "Бисмиллях · колонны, голуби"], [10.4, "С любовью и благодарностью"], [16.2, "Приглашение"],
    [23.0, "Монограмма · фонтан"], [29.8, "Время и место"]
  ];
  var markers = comp.markerProperty;
  for (var i = 0; i < scenes.length; i++) markers.setValueAtTime(scenes[i][0], new MarkerValue(scenes[i][1]));

  // --- audio ------------------------------------------------------------
  if (musicItem) {
    var a = comp.layers.add(musicItem);
    a.name = "Музыка";
    var lvl = a.property("ADBE Audio Group").property("ADBE Audio Levels");
    lvl.setValueAtTime(0, [-40, -40]); lvl.setValueAtTime(1.5, [0, 0]);
    lvl.setValueAtTime(DUR - 2, [0, 0]); lvl.setValueAtTime(DUR, [-40, -40]);
  }

  // --- camera null (hand-held feel) -------------------------------------
  var cam = comp.layers.addNull(DUR);
  cam.name = "CAM · ручная камера";
  cam.property("ADBE Transform Group").property("ADBE Position")
     .expression = "w = wiggle(0.6, 4); [w[0], w[1]]";
  cam.property("ADBE Transform Group").property("ADBE Rotate Z")
     .expression = "wiggle(0.4, 0.35)";

  // --- 3D render ----------------------------------------------------------
  var base = comp.layers.add(footage);
  base.name = "3D-рендер · основной";
  base.parent = cam;
  base.property("ADBE Transform Group").property("ADBE Scale").setValue([102, 102]); // запас под wiggle

  // diffusion glow copy
  var diff = base.duplicate();
  diff.name = "Диффузия · мягкий ореол";
  diff.blendingMode = BlendingMode.SCREEN;
  diff.property("ADBE Transform Group").property("ADBE Opacity").setValue(22);
  var gb = fx(diff, "ADBE Gaussian Blur 2", "Ореол");
  setIf(gb, "ADBE Gaussian Blur 2-0001", 45);

  // --- colour grade (adjustment) -----------------------------------------
  var grade = comp.layers.addSolid([1, 1, 1], "ГРЕЙД · цветокоррекция", W, H, 1, DUR);
  grade.adjustmentLayer = true;
  fx(grade, "ADBE CurvesCustom", "Кривые · контраст");
  var hs = fx(grade, "ADBE HUE SATURATION", "Тёплый оттенок");
  var tint = fx(grade, "ADBE Tint", "Сливочный тон");
  setIf(tint, "ADBE Tint-0003", 12); // amount
  var glow = fx(grade, "ADBE Glo2", "Свечение бликов");
  setIf(glow, "ADBE Glo2-0002", 78); // threshold
  setIf(glow, "ADBE Glo2-0003", 40); // radius
  setIf(glow, "ADBE Glo2-0004", 0.6); // intensity

  // --- light leaks on the transitions --------------------------------------
  var leak = comp.layers.addSolid([1, 0.85, 0.7], "Лайтлик · переходы", W, H, 1, DUR);
  leak.blendingMode = BlendingMode.SCREEN;
  var fn = fx(leak, "ADBE Fractal Noise", "Засветка");
  try { fn.property("ADBE Fractal Noise-0006").expression = "time * 40"; } catch (e) {} // evolution
  fx(leak, "ADBE Tint", "Тёплый тон засветки");
  var lop = leak.property("ADBE Transform Group").property("ADBE Opacity");
  var flashes = [3.6, 6.0, 10.4, 23.0];
  lop.setValueAtTime(0, 0);
  for (var k = 0; k < flashes.length; k++) {
    lop.setValueAtTime(flashes[k] - 0.6, 0);
    lop.setValueAtTime(flashes[k], 28);
    lop.setValueAtTime(flashes[k] + 0.9, 0);
  }

  // --- particles: dust in the light & petals ----------------------------
  var dust = comp.layers.addSolid([0, 0, 0], "Частицы · пыль в лучах", W, H, 1, DUR);
  dust.blendingMode = BlendingMode.ADD;
  dust.inPoint = 3.0;
  var pw = fx(dust, "CC Particle World", "Пыль");
  var petals = comp.layers.addSolid([0, 0, 0], "Частицы · лепестки", W, H, 1, DUR);
  petals.blendingMode = BlendingMode.SCREEN;
  petals.inPoint = 5.5;
  fx(petals, "CC Particle World", "Лепестки");

  // --- vignette & grain ---------------------------------------------------
  var vig = comp.layers.addSolid([0.18, 0.13, 0.1], "Виньетка", W, H, 1, DUR);
  var mask = vig.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
  var shape = new Shape();
  shape.vertices = [[W * 0.5, -H * 0.05], [W * 1.05, H * 0.5], [W * 0.5, H * 1.05], [-W * 0.05, H * 0.5]];
  shape.inTangents = [[-W * 0.3, 0], [0, -H * 0.3], [W * 0.3, 0], [0, H * 0.3]];
  shape.outTangents = [[W * 0.3, 0], [0, H * 0.3], [-W * 0.3, 0], [0, -H * 0.3]];
  shape.closed = true;
  mask.property("ADBE Mask Shape").setValue(shape);
  mask.inverted = true;
  mask.property("ADBE Mask Feather").setValue([420, 420]);
  vig.property("ADBE Transform Group").property("ADBE Opacity").setValue(28);

  var grain = comp.layers.addSolid([1, 1, 1], "Плёночное зерно", W, H, 1, DUR);
  grain.adjustmentLayer = true;
  fx(grain, "VISINF Grain Implant", "Зерно");

  // --- scene guide labels (not rendered) ---------------------------------
  for (var s = 0; s < scenes.length; s++) {
    var t = comp.layers.addText(scenes[s][1]);
    t.name = "GUIDE · " + scenes[s][1];
    t.guideLayer = true;
    t.inPoint = scenes[s][0];
    t.outPoint = s + 1 < scenes.length ? scenes[s + 1][0] : DUR;
    t.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, 120]);
    t.shy = false;
  }

  // --- render queue -------------------------------------------------------
  var rq = proj.renderQueue.items.add(comp);
  comp.openInViewer();
  app.endUndoGroup();
  alert("Готово: композиция «" + comp.name + "» собрана и добавлена в очередь рендера.");
})();
