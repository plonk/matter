'use strict';

function withDefault(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  } else {
    return value;
  }
}

module.exports = {
  withDefault: withDefault,
};

