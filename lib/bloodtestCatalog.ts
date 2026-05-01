// COACH/lib/bloodtestCatalog.ts
// Marker catalog for blood test feature.
// ATHLETE mirror: ATHLETE/src/utils/bloodtestCatalog.js — parity tested in scripts/test-bloodtest-catalog.mjs

export type BloodtestPreset = 'basic' | 'hormonal_plus' | 'total'

export type BloodtestCategory =
  | 'hema' | 'iron' | 'vitamin' | 'mineral'
  | 'hormone_sex' | 'thyroid' | 'inflammation' | 'metabolism' | 'liver' | 'lipid'

export type ZoneSeverity = 1 | 2 | 3 | 4   // 1=best/optimal, 4=worst/critical

export type ZoneBand = {
  label: string                              // 'optimal' | 'deficience' | 'low' | 'normal' | 'high' | 'severe' | etc.
  severity: ZoneSeverity                     // for color mapping
  min?: number                               // inclusive lower bound (omit for "below all" band)
  max?: number                               // exclusive upper bound (omit for "above all" band)
}

export type ZoneConfig = {
  direction: 'higher_is_better' | 'lower_is_better' | 'range_is_normal'
  bands: ZoneBand[]                          // ordered, contiguous, cover the value space
}

export type SexSpecificZones = {
  male?: ZoneConfig
  female?: ZoneConfig
  female_by_phase?: Partial<Record<'folliculaire' | 'ovulatoire' | 'luteale' | 'menopause', ZoneConfig>>
}

export type BloodtestMarker = {
  key: string
  label: string
  unit_canonical: string
  unit_aliases: string[]
  category: BloodtestCategory
  zones: ZoneConfig | { sex_specific: SexSpecificZones }
  presets: BloodtestPreset[]
  supplementation?: {
    forms: string[]
    dosage_general: string
    timing: string
  }
  notes?: string
}

export const MARKERS: BloodtestMarker[] = [
  // ==================== basic (9 markers) ====================
  {
    key: 'hemoglobine',
    label: 'Hémoglobine',
    unit_canonical: 'g/L',
    unit_aliases: ['g/dL'],
    category: 'hema',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'bas', severity: 3, max: 130 },
            { label: 'normal', severity: 1, min: 130, max: 170 },
            { label: 'haut', severity: 3, min: 170 },
          ],
        },
        female: {
          direction: 'range_is_normal',
          bands: [
            { label: 'bas', severity: 3, max: 120 },
            { label: 'normal', severity: 1, min: 120, max: 160 },
            { label: 'haut', severity: 3, min: 160 },
          ],
        },
      },
    },
  },
  {
    key: 'ferritine',
    label: 'Ferritine',
    unit_canonical: 'µg/L',
    unit_aliases: ['ng/mL'],
    category: 'iron',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 50 },
        { label: 'deficience', severity: 2, min: 30, max: 50 },
        { label: 'carence', severity: 3, min: 15, max: 30 },
        { label: 'avitaminose', severity: 4, max: 15 },
      ],
    },
    supplementation: {
      forms: ['Bisglycinate de fer', 'Sulfate ferreux', 'Fer héminique'],
      dosage_general: '14-28 mg/jour',
      timing: 'À jeun ou 2h après repas, loin du calcium',
    },
  },
  {
    key: 'fer_serique',
    label: 'Fer sérique',
    unit_canonical: 'µmol/L',
    unit_aliases: [],
    category: 'iron',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 12 },
        { label: 'deficience', severity: 2, min: 9, max: 12 },
        { label: 'carence', severity: 3, min: 6, max: 9 },
        { label: 'avitaminose', severity: 4, max: 6 },
      ],
    },
  },
  {
    key: 'vitamine_d',
    label: 'Vitamine D (25-OH-D)',
    unit_canonical: 'ng/mL',
    unit_aliases: ['nmol/L'],
    category: 'vitamin',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 30 },
        { label: 'deficience', severity: 2, min: 20, max: 30 },
        { label: 'carence', severity: 3, min: 10, max: 20 },
        { label: 'avitaminose', severity: 4, max: 10 },
      ],
    },
    supplementation: {
      forms: ['Cholécalciférol naturel (D3)'],
      dosage_general: 'Entretien: 800-1000 UI · Déficience: 2000-3000 UI · Carence: 4000-5000 UI · Avitaminose: 5000+ UI',
      timing: 'Avec une source de lipides / après un repas',
    },
  },
  {
    key: 'b12',
    label: 'Vitamine B12',
    unit_canonical: 'pmol/L',
    unit_aliases: ['pg/mL'],
    category: 'vitamin',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 250 },
        { label: 'deficience', severity: 2, min: 150, max: 250 },
        { label: 'carence', severity: 3, min: 75, max: 150 },
        { label: 'avitaminose', severity: 4, max: 75 },
      ],
    },
    supplementation: {
      forms: ['Méthylcobalamine', 'Adénosylcobalamine'],
      dosage_general: '2.5-25 µg/jour',
      timing: 'À distance des repas',
    },
  },
  {
    key: 'folates_b9',
    label: 'Folates (B9)',
    unit_canonical: 'nmol/L',
    unit_aliases: [],
    category: 'vitamin',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 1300 },
        { label: 'deficience', severity: 2, min: 800, max: 1300 },
        { label: 'carence', severity: 3, min: 300, max: 800 },
        { label: 'avitaminose', severity: 4, max: 300 },
      ],
    },
    supplementation: {
      forms: ['Quatrefolic', 'Folinate de calcium', 'Calcium L-méthylfolate', '5-MTHF'],
      dosage_general: '200-500 µg/jour',
      timing: 'Avec un repas',
    },
  },
  {
    key: 'magnesium_serique',
    label: 'Magnésium sérique',
    unit_canonical: 'mmol/L',
    unit_aliases: ['mg/L'],
    category: 'mineral',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 0.75 },
        { label: 'deficience', severity: 2, min: 0.65, max: 0.75 },
        { label: 'carence', severity: 3, min: 0.55, max: 0.65 },
        { label: 'avitaminose', severity: 4, max: 0.55 },
      ],
    },
    supplementation: {
      forms: ['Bisglycinate de magnésium', 'Malate', 'Pidolate', 'Glycérophosphate', 'Acétyl-taurinate', 'Citrate', 'Thréonate', 'Gluconate'],
      dosage_general: '200-300 mg/jour (min 500 mg si carence)',
      timing: 'Soir, hors repas riche en calcium',
    },
  },
  {
    key: 'tsh_us',
    label: 'TSH ultrasensible',
    unit_canonical: 'mUI/L',
    unit_aliases: ['mIU/L'],
    category: 'thyroid',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      direction: 'range_is_normal',
      bands: [
        { label: 'low', severity: 3, max: 0.4 },
        { label: 'normal', severity: 1, min: 0.4, max: 4.0 },
        { label: 'high', severity: 3, min: 4.0 },
      ],
    },
  },
  {
    key: 'crp_us',
    label: 'CRP ultrasensible',
    unit_canonical: 'mg/L',
    unit_aliases: [],
    category: 'inflammation',
    presets: ['basic', 'hormonal_plus', 'total'],
    zones: {
      direction: 'lower_is_better',
      bands: [
        { label: 'optimal', severity: 1, max: 1 },
        { label: 'leger', severity: 2, min: 1, max: 3 },
        { label: 'modere', severity: 3, min: 3, max: 10 },
        { label: 'severe', severity: 4, min: 10 },
      ],
    },
  },

  // ==================== hormonal+ (17 markers) ====================
  {
    key: 'estrone_e1',
    label: 'Estrone (E1)',
    unit_canonical: 'pg/mL',
    unit_aliases: [],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      direction: 'range_is_normal',
      bands: [
        { label: 'low', severity: 3, max: 30 },
        { label: 'normal', severity: 1, min: 30, max: 200 },
        { label: 'high', severity: 3, min: 200 },
      ],
    },
    notes: 'Valeurs hors grossesse. Pas de différenciation sexe dans la spec.',
  },
  {
    key: 'estradiol_e2',
    label: 'Estradiol (E2)',
    unit_canonical: 'pg/mL',
    unit_aliases: ['pmol/L'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 10 },
            { label: 'normal', severity: 1, min: 10, max: 40 },
            { label: 'high', severity: 3, min: 40 },
          ],
        },
        female_by_phase: {
          folliculaire: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 30 },
              { label: 'normal', severity: 1, min: 30, max: 120 },
              { label: 'high', severity: 3, min: 120 },
            ],
          },
          ovulatoire: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 130 },
              { label: 'normal', severity: 1, min: 130, max: 370 },
              { label: 'high', severity: 3, min: 370 },
            ],
          },
          luteale: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 70 },
              { label: 'normal', severity: 1, min: 70, max: 250 },
              { label: 'high', severity: 3, min: 250 },
            ],
          },
          menopause: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 5 },
              { label: 'normal', severity: 1, min: 5, max: 30 },
              { label: 'high', severity: 3, min: 30 },
            ],
          },
        },
      },
    },
  },
  {
    key: 'estriol_e3',
    label: 'Estriol (E3)',
    unit_canonical: 'ng/mL',
    unit_aliases: [],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 0.5 },
            { label: 'normal', severity: 1, min: 0.5, max: 10 },
            { label: 'high', severity: 3, min: 10 },
          ],
        },
        female: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 0.5 },
            { label: 'normal', severity: 1, min: 0.5, max: 10 },
            { label: 'high', severity: 3, min: 10 },
          ],
        },
      },
    },
    notes: 'Valeurs hors grossesse. Ménopause peut être < 0.5 ng/mL (normal en post-ménopause).',
  },
  {
    key: 'progesterone',
    label: 'Progestérone',
    unit_canonical: 'ng/mL',
    unit_aliases: ['nmol/L'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        female_by_phase: {
          folliculaire: {
            direction: 'range_is_normal',
            bands: [
              { label: 'normal', severity: 1, max: 1 },
              { label: 'high', severity: 3, min: 1 },
            ],
          },
          luteale: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 5 },
              { label: 'normal', severity: 1, min: 5, max: 25 },
              { label: 'high', severity: 3, min: 25 },
            ],
          },
          menopause: {
            direction: 'range_is_normal',
            bands: [
              { label: 'normal', severity: 1, max: 1 },
              { label: 'high', severity: 3, min: 1 },
            ],
          },
        },
      },
    },
    notes: 'À doser autour du jour 21 du cycle. Pas de valeur male dans la spec.',
  },
  {
    key: 'lh',
    label: 'LH',
    unit_canonical: 'UI/L',
    unit_aliases: ['mUI/mL'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 1.5 },
            { label: 'normal', severity: 1, min: 1.5, max: 9 },
            { label: 'high', severity: 3, min: 9 },
          ],
        },
        female_by_phase: {
          folliculaire: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 2 },
              { label: 'normal', severity: 1, min: 2, max: 10 },
              { label: 'high', severity: 3, min: 10 },
            ],
          },
          ovulatoire: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 20 },
              { label: 'normal', severity: 1, min: 20, max: 100 },
              { label: 'high', severity: 3, min: 100 },
            ],
          },
          luteale: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 1 },
              { label: 'normal', severity: 1, min: 1, max: 10 },
              { label: 'high', severity: 3, min: 10 },
            ],
          },
          menopause: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 15 },
              { label: 'normal', severity: 1, min: 15, max: 60 },
              { label: 'high', severity: 3, min: 60 },
            ],
          },
        },
      },
    },
  },
  {
    key: 'fsh',
    label: 'FSH',
    unit_canonical: 'UI/L',
    unit_aliases: ['mUI/mL'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 1.5 },
            { label: 'normal', severity: 1, min: 1.5, max: 12 },
            { label: 'high', severity: 3, min: 12 },
          ],
        },
        female_by_phase: {
          folliculaire: {
            direction: 'range_is_normal',
            bands: [
              { label: 'low', severity: 3, max: 3 },
              { label: 'normal', severity: 1, min: 3, max: 10 },
              { label: 'high', severity: 3, min: 10 },
            ],
          },
          menopause: {
            direction: 'range_is_normal',
            bands: [
              { label: 'normal', severity: 1, max: 25 },
              { label: 'high', severity: 3, min: 25 },
            ],
          },
        },
      },
    },
    notes: 'FSH femme : valeurs luteale/ovulatoire non spécifiées dans la spec — doser en phase folliculaire.',
  },
  {
    key: 'shbg',
    label: 'SHBG',
    unit_canonical: 'nmol/L',
    unit_aliases: [],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 13 },
            { label: 'normal', severity: 1, min: 13, max: 71 },
            { label: 'high', severity: 3, min: 71 },
          ],
        },
        female: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 18 },
            { label: 'normal', severity: 1, min: 18, max: 144 },
            { label: 'high', severity: 3, min: 144 },
          ],
        },
      },
    },
  },
  {
    key: 'testosterone_totale',
    label: 'Testostérone totale',
    unit_canonical: 'ng/mL',
    unit_aliases: ['nmol/L'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 2.5 },
            { label: 'normal', severity: 1, min: 2.5, max: 9 },
            { label: 'high', severity: 3, min: 9 },
          ],
        },
        female: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 0.1 },
            { label: 'normal', severity: 1, min: 0.1, max: 0.7 },
            { label: 'high', severity: 3, min: 0.7 },
          ],
        },
      },
    },
  },
  {
    key: 'testosterone_libre',
    label: 'Testostérone libre',
    unit_canonical: 'pg/mL',
    unit_aliases: [],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 50 },
            { label: 'normal', severity: 1, min: 50, max: 200 },
            { label: 'high', severity: 3, min: 200 },
          ],
        },
        female: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 0.5 },
            { label: 'normal', severity: 1, min: 0.5, max: 4.5 },
            { label: 'high', severity: 3, min: 4.5 },
          ],
        },
      },
    },
  },
  {
    key: 'dhea_s',
    label: 'DHEA-S',
    unit_canonical: 'µg/dL',
    unit_aliases: ['µmol/L'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 80 },
            { label: 'normal', severity: 1, min: 80, max: 560 },
            { label: 'high', severity: 3, min: 560 },
          ],
        },
        female: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 35 },
            { label: 'normal', severity: 1, min: 35, max: 430 },
            { label: 'high', severity: 3, min: 430 },
          ],
        },
      },
    },
    notes: 'Valeurs variables selon âge. Plages ici = adulte 20-50 ans.',
  },
  {
    key: 'androstenedione',
    label: 'Androstènedione',
    unit_canonical: 'ng/mL',
    unit_aliases: ['nmol/L'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 0.5 },
            { label: 'normal', severity: 1, min: 0.5, max: 3.0 },
            { label: 'high', severity: 3, min: 3.0 },
          ],
        },
        female: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 0.4 },
            { label: 'normal', severity: 1, min: 0.4, max: 3.4 },
            { label: 'high', severity: 3, min: 3.4 },
          ],
        },
      },
    },
  },
  {
    key: 'oh17_progesterone',
    label: '17-OH-progestérone',
    unit_canonical: 'ng/mL',
    unit_aliases: ['nmol/L'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'normal', severity: 1, max: 2 },
            { label: 'high', severity: 3, min: 2 },
          ],
        },
        female_by_phase: {
          folliculaire: {
            direction: 'range_is_normal',
            bands: [
              { label: 'normal', severity: 1, max: 1 },
              { label: 'high', severity: 3, min: 1 },
            ],
          },
          luteale: {
            direction: 'range_is_normal',
            bands: [
              { label: 'normal', severity: 1, max: 4 },
              { label: 'high', severity: 3, min: 4 },
            ],
          },
        },
      },
    },
    notes: 'Marqueur clé pour hyperandrogénisme (SOPK). Pas de seuil bas clinique, seul le haut est pathologique.',
  },
  {
    key: 'prolactine',
    label: 'Prolactine',
    unit_canonical: 'µg/L',
    unit_aliases: ['ng/mL', 'mUI/L'],
    category: 'hormone_sex',
    presets: ['hormonal_plus', 'total'],
    zones: {
      sex_specific: {
        male: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 4 },
            { label: 'normal', severity: 1, min: 4, max: 15 },
            { label: 'high', severity: 3, min: 15 },
          ],
        },
        female: {
          direction: 'range_is_normal',
          bands: [
            { label: 'low', severity: 3, max: 4 },
            { label: 'normal', severity: 1, min: 4, max: 25 },
            { label: 'high', severity: 3, min: 25 },
          ],
        },
      },
    },
    notes: 'Hors grossesse/allaitement. Élévation peut indiquer adénome ou hypothyroïdie.',
  },
  {
    key: 'ft4',
    label: 'T4 libre (FT4)',
    unit_canonical: 'pmol/L',
    unit_aliases: ['ng/dL'],
    category: 'thyroid',
    presets: ['hormonal_plus', 'total'],
    zones: {
      direction: 'range_is_normal',
      bands: [
        { label: 'low', severity: 3, max: 9 },
        { label: 'normal', severity: 1, min: 9, max: 22 },
        { label: 'high', severity: 3, min: 22 },
      ],
    },
  },
  {
    key: 'ft3',
    label: 'T3 libre (FT3)',
    unit_canonical: 'pmol/L',
    unit_aliases: ['pg/mL'],
    category: 'thyroid',
    presets: ['hormonal_plus', 'total'],
    zones: {
      direction: 'range_is_normal',
      bands: [
        { label: 'low', severity: 3, max: 3 },
        { label: 'normal', severity: 1, min: 3, max: 7 },
        { label: 'high', severity: 3, min: 7 },
      ],
    },
  },
  {
    key: 'anti_tpo',
    label: 'Anti-TPO',
    unit_canonical: 'UI/mL',
    unit_aliases: ['kUI/L'],
    category: 'thyroid',
    presets: ['hormonal_plus', 'total'],
    zones: {
      direction: 'lower_is_better',
      bands: [
        { label: 'optimal', severity: 1, max: 35 },
        { label: 'leger', severity: 2, min: 35, max: 100 },
        { label: 'modere', severity: 3, min: 100, max: 500 },
        { label: 'severe', severity: 4, min: 500 },
      ],
    },
    notes: 'Anticorps anti-thyroperoxydase. Élévation = thyroïdite auto-immune probable (Hashimoto).',
  },
  {
    key: 'anti_tg',
    label: 'Anti-thyroglobuline',
    unit_canonical: 'UI/mL',
    unit_aliases: ['kUI/L'],
    category: 'thyroid',
    presets: ['hormonal_plus', 'total'],
    zones: {
      direction: 'lower_is_better',
      bands: [
        { label: 'optimal', severity: 1, max: 40 },
        { label: 'leger', severity: 2, min: 40, max: 100 },
        { label: 'modere', severity: 3, min: 100, max: 500 },
        { label: 'severe', severity: 4, min: 500 },
      ],
    },
    notes: 'Anticorps anti-thyroglobuline. Complémentaire à Anti-TPO pour thyroïdite auto-immune.',
  },

  // ==================== total (8 markers) ====================
  {
    key: 'vitamine_e',
    label: 'Vitamine E',
    unit_canonical: 'µmol/L',
    unit_aliases: ['mg/L'],
    category: 'vitamin',
    presets: ['total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 20 },
        { label: 'deficience', severity: 2, min: 8, max: 20 },
        { label: 'carence', severity: 3, min: 5, max: 8 },
        { label: 'avitaminose', severity: 4, max: 5 },
      ],
    },
    supplementation: {
      forms: ['Tocophérols mixtes', 'Alpha-tocophérol naturel'],
      dosage_general: '15-30 mg/jour',
      timing: 'Avec un repas gras',
    },
  },
  {
    key: 'magnesium_erythrocytaire',
    label: 'Magnésium érythrocytaire',
    unit_canonical: 'mmol/L',
    unit_aliases: [],
    category: 'mineral',
    presets: ['total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 1.7 },
        { label: 'deficience', severity: 2, min: 1.5, max: 1.7 },
        { label: 'carence', severity: 3, min: 1.3, max: 1.5 },
        { label: 'avitaminose', severity: 4, max: 1.3 },
      ],
    },
    notes: 'Préféré au magnésium sérique (plus fidèle aux réserves intracellulaires).',
    supplementation: {
      forms: ['Bisglycinate de magnésium', 'Malate', 'Pidolate', 'Glycérophosphate', 'Acétyl-taurinate'],
      dosage_general: '300-400 mg/jour',
      timing: 'Soir, hors repas riche en calcium',
    },
  },
  {
    key: 'zinc',
    label: 'Zinc',
    unit_canonical: 'µmol/L',
    unit_aliases: ['µg/dL'],
    category: 'mineral',
    presets: ['total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 11 },
        { label: 'deficience', severity: 2, min: 8, max: 11 },
        { label: 'carence', severity: 3, min: 3, max: 8 },
        { label: 'avitaminose', severity: 4, max: 3 },
      ],
    },
    supplementation: {
      forms: ['Bisglycinate de zinc', 'Citrate de zinc', 'Picolinate de zinc'],
      dosage_general: '8-15 mg/jour',
      timing: 'Hors repas (ou avec petit repas), loin du calcium',
    },
  },
  {
    key: 'cuivre',
    label: 'Cuivre',
    unit_canonical: 'µmol/L',
    unit_aliases: ['µg/dL'],
    category: 'mineral',
    presets: ['total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 13 },
        { label: 'deficience', severity: 2, min: 8, max: 13 },
        { label: 'carence', severity: 3, min: 5, max: 8 },
        { label: 'avitaminose', severity: 4, max: 5 },
      ],
    },
    notes: 'Ratio zinc/cuivre important. Supplémenter avec précaution : excès cuivre antagonise zinc.',
  },
  {
    key: 'selenium',
    label: 'Sélénium',
    unit_canonical: 'µg/L',
    unit_aliases: ['nmol/L'],
    category: 'mineral',
    presets: ['total'],
    zones: {
      direction: 'higher_is_better',
      bands: [
        { label: 'optimal', severity: 1, min: 80 },
        { label: 'deficience', severity: 2, min: 60, max: 80 },
        { label: 'carence', severity: 3, min: 30, max: 60 },
        { label: 'avitaminose', severity: 4, max: 30 },
      ],
    },
    supplementation: {
      forms: ['Sélénométhionine', 'Sélénite de sodium'],
      dosage_general: '50-100 µg/jour',
      timing: 'Avec un repas',
    },
  },
  {
    key: 'transferrine',
    label: 'Transferrine',
    unit_canonical: 'g/L',
    unit_aliases: [],
    category: 'iron',
    presets: ['total'],
    zones: {
      direction: 'range_is_normal',
      bands: [
        { label: 'low', severity: 3, max: 2.0 },
        { label: 'normal', severity: 1, min: 2.0, max: 3.6 },
        { label: 'high', severity: 3, min: 3.6 },
      ],
    },
  },
  {
    key: 'cft_tibc',
    label: 'CFT / TIBC',
    unit_canonical: 'µmol/L',
    unit_aliases: ['µg/dL'],
    category: 'iron',
    presets: ['total'],
    zones: {
      direction: 'range_is_normal',
      bands: [
        { label: 'low', severity: 3, max: 45 },
        { label: 'normal', severity: 1, min: 45, max: 80 },
        { label: 'high', severity: 3, min: 80 },
      ],
    },
    notes: 'Capacité totale de fixation du fer (TIBC). Élevé en carence martiale, bas en surcharge.',
  },
  {
    key: 'coef_sat_transferrine',
    label: 'Coefficient saturation transferrine',
    unit_canonical: '%',
    unit_aliases: [],
    category: 'iron',
    presets: ['total'],
    zones: {
      direction: 'range_is_normal',
      bands: [
        { label: 'low', severity: 3, max: 20 },
        { label: 'normal', severity: 1, min: 20, max: 40 },
        { label: 'high', severity: 3, min: 40 },
      ],
    },
    notes: 'Bas < 20% = carence martiale probable. Haut > 40% = surcharge en fer possible (hémochromatose).',
  },
]

export const PRESETS: Record<BloodtestPreset, string[]> = {
  basic: MARKERS.filter((m) => m.presets.includes('basic')).map((m) => m.key),
  hormonal_plus: MARKERS.filter((m) => m.presets.includes('hormonal_plus')).map((m) => m.key),
  total: MARKERS.filter((m) => m.presets.includes('total')).map((m) => m.key),
}

export function getMarker(key: string): BloodtestMarker | undefined {
  return MARKERS.find((m) => m.key === key)
}

export function getPresetMarkers(preset: BloodtestPreset): BloodtestMarker[] {
  return MARKERS.filter((m) => m.presets.includes(preset))
}
