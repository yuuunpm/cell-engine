// ================================================================
// species.js - 物种系统公共 API 组装器 (v4.0)
// 
// 加载顺序:
//   1. species_core.js       (数据字典 + 基础属性构建器)
//   2. species_ant.js        (蚂蚁行为 + 绘制代码)
//   3. species_plant.js      (植物行为 + 绘制代码)
//   4. species_insect.js     (昆虫行为 + 绘制代码)
//   5. species_scene.js      (场景对象 + 地图预设 + 外观绘制)
//   6. species.js            (本文件，公共 API 汇总)
//
// 本文件把各模块导出的函数汇总为一个统一的 SpeciesRegistry 对象
// 供外部代码调用，同时暴露在 global 层级以便 AI 控制台直接使用。
// ================================================================
(function (global) {
  'use strict';

  // 确保所有依赖模块已加载
  if (!global._SpeciesData || !global._SpeciesFns) {
    console.warn('SpeciesRegistry: species_core.js 未加载，请检查脚本加载顺序');
    return;
  }

  const D = global._SpeciesData;
  const F = global._SpeciesFns;

  // ===== 导出公共 API =====
  // 暴露一个 SpeciesRegistry 对象（兼容旧代码）
  const SpeciesRegistry = {
    // 数据字典访问
    getAnt: function (key) { return D.ANT_SPECIES[key]; },
    getPlant: function (key) { return D.PLANT_SPECIES[key]; },
    getInsect: function (key) { return D.INSECT_SPECIES[key]; },
    getAllAnts: function () { return D.ANT_SPECIES; },
    getAllPlants: function () { return D.PLANT_SPECIES; },
    getAllInsects: function () { return D.INSECT_SPECIES; },
    getMapPreset: function (key) { return F.MAP_PRESETS ? F.MAP_PRESETS[key] : null; },
    getMapPresets: function () { return F.MAP_PRESETS; },
    getAntRoles: function (speciesKey) { return (D.ANT_SPECIES[speciesKey] || {}).roles; },
    getPersonalities: function () { return D.ANT_PERSONALITIES; },
    getSceneObjectTypes: function () { return D.SCENE_OBJECT_TYPES; },

    // 属性构建器
    buildAntAttributes: F.buildAntAttributes,
    buildPlantAttributes: F.buildPlantAttributes,
    buildInsectAttributes: F.buildInsectAttributes,
    getSpeciesDescription: F.getSpeciesDescription,

    // 行为代码生成器
    getAntBehaviorCode: F.getAntBehaviorCode,
    getPlantBehaviorCode: F.getPlantBehaviorCode,
    getInsectBehaviorCode: F.getInsectBehaviorCode,
    getSceneObjectBehaviorCode: F.getSceneObjectBehaviorCode,

    // 辅助函数
    getRandomAntSpecies: function () {
      const keys = Object.keys(D.ANT_SPECIES);
      return keys[Math.floor(Math.random() * keys.length)];
    },
    getRandomPlantSpecies: function () {
      const keys = Object.keys(D.PLANT_SPECIES);
      return keys[Math.floor(Math.random() * keys.length)];
    },
    getRandomInsectSpecies: function () {
      const keys = Object.keys(D.INSECT_SPECIES);
      return keys[Math.floor(Math.random() * keys.length)];
    },

    // 地图与绘制
    buildMapScene: F.buildMapScene,
    drawSpeciesAppearance: F.drawSpeciesAppearance,
    SCENE_OBJECT_TYPES: D.SCENE_OBJECT_TYPES
  };

  // 挂到 global/window
  global.SpeciesRegistry = SpeciesRegistry;

  // 同时把关键函数暴露到顶层，方便 AI 控制台直接调用
  if (F.buildMapScene) global.buildMapScene = F.buildMapScene;
  if (F.getAntBehaviorCode) global.getAntBehaviorCode = F.getAntBehaviorCode;
  if (F.drawSpeciesAppearance) global.drawSpeciesAppearance = F.drawSpeciesAppearance;

  console.log('[SpeciesRegistry] v4.0 模块系统已加载完成');

})(typeof window !== 'undefined' ? window : globalThis);
