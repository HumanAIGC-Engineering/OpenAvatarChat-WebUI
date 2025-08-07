export default {
  extends: ['stylelint-config-standard'],
  // stylelint不识别:global, 添加selector-pseudo-class-no-unknown忽略:global
  rules: {
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global'],
      },
    ],
    // 对:global处理有问题, 所以关掉该规则
    'no-descending-specificity': null,
    // 要求css的选择器名称是kebab-case, 历史代码很多是驼峰的, 所以关掉该规则
    'selector-class-pattern': null,
    // 该规则不允许供应商前缀值; 而最多显示几行时需要display: -webkit-box; 所以忽略'box'
    'value-no-vendor-prefix': [true, { ignoreValues: ['box'] }],
    'custom-property-pattern': '^([a-zA-Z0-9]|-|_)*$',
    'rule-empty-line-before': null,
    'declaration-empty-line-before': null,
    'allow-empty-input': true,
    // 采用系统默认字体
    'font-family-no-missing-generic-family-keyword': null,
  },
  overrides: [
    {
      files: ['**/*.less'],
      customSyntax: 'postcss-less',
    },
  ],
};
