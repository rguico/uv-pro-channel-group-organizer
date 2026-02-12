const CTCSS_VALUES = [
  67, 69.3, 71.9, 74.4, 77, 79.7, 82.5, 85.4, 88.5, 91.5,
  94.8, 97.4, 100, 103.5, 107.2, 110.9, 114.8, 118.8, 123, 127.3,
  131.8, 136.5, 141.3, 146.2, 150.0, 151.4, 156.7, 159.8, 162.2, 165.5,
  167.9, 171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6,
  199.5, 203.5, 206.5, 210.7, 213.8, 218.1, 225.7, 229.1, 233.6, 237.1,
  241.8, 245.5, 250.3, 254.1
];

const CTCSS_STORED = CTCSS_VALUES.map(v => Math.round(v * 100));

const DCS_CODES = [
  23, 25, 26, 31, 32, 36, 43, 47, 51, 53, 54, 65, 71, 72, 73, 74,
  114, 115, 116, 122, 125, 131, 132, 134, 143, 145, 152, 155, 156, 162,
  165, 172, 174, 205, 212, 223, 225, 226, 243, 244, 245, 246, 251, 252,
  255, 261, 263, 265, 266, 271, 274, 306, 311, 315, 325, 331, 332, 343,
  346, 351, 356, 364, 365, 371, 411, 412, 413, 423, 431, 432, 445, 446,
  452, 454, 455, 462, 464, 465, 466, 503, 506, 516, 523, 526, 532, 546,
  565, 606, 612, 624, 627, 631, 632, 654, 662, 664, 703, 712, 723, 731,
  732, 734, 743, 754
];

function validateChannel(fields) {
  const errors = [];

  // title: ASCII only, max 8 chars
  if (fields.title !== undefined) {
    if (!/^[\x20-\x7E]*$/.test(fields.title)) {
      errors.push('Title must contain only ASCII characters.');
    }
    if (fields.title.length > 8) {
      errors.push('Title must be 8 characters or fewer.');
    }
  }

  // tx_freq: 0 or 144–148 or 420–450 MHz
  if (fields.tx_freq !== undefined) {
    const mhz = parseInt(fields.tx_freq, 10) / 1000000;
    if (mhz !== 0) {
      if (!((mhz >= 144 && mhz <= 148) || (mhz >= 420 && mhz <= 450))) {
        errors.push('TX Freq must be 0 or in 144.000–148.000 or 420.000–450.000 MHz.');
      }
    }
  }

  // rx_freq: 0 or 88–137 or 144–148 or 420–450 MHz
  if (fields.rx_freq !== undefined) {
    const mhz = parseInt(fields.rx_freq, 10) / 1000000;
    if (mhz !== 0) {
      if (!((mhz >= 88 && mhz <= 137) || (mhz >= 144 && mhz <= 148) || (mhz >= 420 && mhz <= 450))) {
        errors.push('RX Freq must be 0 or in 88.000–137.000, 144.000–148.000, or 420.000–450.000 MHz.');
      }
    }
  }

  // subtone validation helper
  function validateSubtone(value, label) {
    const v = parseInt(value, 10);
    if (v === 0) return;
    if (CTCSS_STORED.indexOf(v) >= 0) return;
    if (DCS_CODES.indexOf(v) >= 0) return;
    errors.push(label + ' must be 0 (Off), a valid CTCSS tone, or a valid DCS code.');
  }

  if (fields.tx_sub_audio !== undefined) {
    validateSubtone(fields.tx_sub_audio, 'TX Subtone');
  }
  if (fields.rx_sub_audio !== undefined) {
    validateSubtone(fields.rx_sub_audio, 'RX Subtone');
  }

  // tx_power
  if (fields.tx_power !== undefined) {
    if (['H', 'M', 'L'].indexOf(fields.tx_power) < 0) {
      errors.push('TX Power must be H, M, or L.');
    }
  }

  // bandwidth
  if (fields.bandwidth !== undefined) {
    if (fields.bandwidth !== '12500' && fields.bandwidth !== '25000') {
      errors.push('Bandwidth must be 12500 or 25000.');
    }
  }

  // binary fields
  const binaryFields = [
    ['scan', 'Scan'],
    ['talk_around', 'Talk Around'],
    ['pre_de_emph_bypass', 'Pre/De-Emphasis Bypass'],
    ['sign', 'Sign'],
    ['tx_dis', 'TX Disable'],
    ['bclo', 'BCLO'],
    ['mute', 'Mute']
  ];
  for (const [key, label] of binaryFields) {
    if (fields[key] !== undefined) {
      if (fields[key] !== '0' && fields[key] !== '1') {
        errors.push(label + ' must be 0 or 1.');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
