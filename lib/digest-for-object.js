'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createDigestForObject;

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function updateDigestForJsonValue(shasum, value) {
  // Implmentation is similar to that of pretty-printing a JSON object, except:
  // * Strings are not escaped.
  // * No effort is made to avoid trailing commas.
  // These shortcuts should not affect the correctness of this function.
  const type = typeof value;

  if (type === 'string') {
    shasum.update('"', 'utf8');
    shasum.update(value, 'utf8');
    shasum.update('"', 'utf8');
    return;
  }

  if (type === 'boolean' || type === 'number') {
    shasum.update(value.toString(), 'utf8');
    return;
  }

  if (!value) {
    shasum.update('null', 'utf8');
    return;
  }

  if (Array.isArray(value)) {
    shasum.update('[', 'utf8');
    for (let i = 0; i < value.length; i++) {
      updateDigestForJsonValue(shasum, value[i]);
      shasum.update(',', 'utf8');
    }
    shasum.update(']', 'utf8');
    return;
  }

  // value must be an object: be sure to sort the keys.
  let keys = Object.keys(value);
  keys.sort();

  shasum.update('{', 'utf8');

  for (let i = 0; i < keys.length; i++) {
    updateDigestForJsonValue(shasum, keys[i]);
    shasum.update(': ', 'utf8');
    updateDigestForJsonValue(shasum, value[keys[i]]);
    shasum.update(',', 'utf8');
  }

  shasum.update('}', 'utf8');
}

/**
 * Creates a hash from a JS object
 * 
 * @private  
 */
function createDigestForObject(obj) {
  let sha1 = _crypto2.default.createHash('sha1');
  updateDigestForJsonValue(sha1, obj);

  return sha1.digest('hex');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9kaWdlc3QtZm9yLW9iamVjdC5qcyJdLCJuYW1lcyI6WyJjcmVhdGVEaWdlc3RGb3JPYmplY3QiLCJ1cGRhdGVEaWdlc3RGb3JKc29uVmFsdWUiLCJzaGFzdW0iLCJ2YWx1ZSIsInR5cGUiLCJ1cGRhdGUiLCJ0b1N0cmluZyIsIkFycmF5IiwiaXNBcnJheSIsImkiLCJsZW5ndGgiLCJrZXlzIiwiT2JqZWN0Iiwic29ydCIsIm9iaiIsInNoYTEiLCJjcmVhdGVIYXNoIiwiZGlnZXN0Il0sIm1hcHBpbmdzIjoiOzs7OztrQkEwRHdCQSxxQjs7QUExRHhCOzs7Ozs7QUFFQSxTQUFTQyx3QkFBVCxDQUFrQ0MsTUFBbEMsRUFBMENDLEtBQTFDLEVBQWlEO0FBQy9DO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBTUMsT0FBTyxPQUFPRCxLQUFwQjs7QUFFQSxNQUFJQyxTQUFTLFFBQWIsRUFBdUI7QUFDckJGLFdBQU9HLE1BQVAsQ0FBYyxHQUFkLEVBQW1CLE1BQW5CO0FBQ0FILFdBQU9HLE1BQVAsQ0FBY0YsS0FBZCxFQUFxQixNQUFyQjtBQUNBRCxXQUFPRyxNQUFQLENBQWMsR0FBZCxFQUFtQixNQUFuQjtBQUNBO0FBQ0Q7O0FBRUQsTUFBSUQsU0FBUyxTQUFULElBQXNCQSxTQUFTLFFBQW5DLEVBQTZDO0FBQzNDRixXQUFPRyxNQUFQLENBQWNGLE1BQU1HLFFBQU4sRUFBZCxFQUFnQyxNQUFoQztBQUNBO0FBQ0Q7O0FBRUQsTUFBSSxDQUFDSCxLQUFMLEVBQVk7QUFDVkQsV0FBT0csTUFBUCxDQUFjLE1BQWQsRUFBc0IsTUFBdEI7QUFDQTtBQUNEOztBQUVELE1BQUlFLE1BQU1DLE9BQU4sQ0FBY0wsS0FBZCxDQUFKLEVBQTBCO0FBQ3hCRCxXQUFPRyxNQUFQLENBQWMsR0FBZCxFQUFtQixNQUFuQjtBQUNBLFNBQUssSUFBSUksSUFBRSxDQUFYLEVBQWNBLElBQUlOLE1BQU1PLE1BQXhCLEVBQWdDRCxHQUFoQyxFQUFxQztBQUNuQ1IsK0JBQXlCQyxNQUF6QixFQUFpQ0MsTUFBTU0sQ0FBTixDQUFqQztBQUNBUCxhQUFPRyxNQUFQLENBQWMsR0FBZCxFQUFtQixNQUFuQjtBQUNEO0FBQ0RILFdBQU9HLE1BQVAsQ0FBYyxHQUFkLEVBQW1CLE1BQW5CO0FBQ0E7QUFDRDs7QUFFRDtBQUNBLE1BQUlNLE9BQU9DLE9BQU9ELElBQVAsQ0FBWVIsS0FBWixDQUFYO0FBQ0FRLE9BQUtFLElBQUw7O0FBRUFYLFNBQU9HLE1BQVAsQ0FBYyxHQUFkLEVBQW1CLE1BQW5COztBQUVBLE9BQUssSUFBSUksSUFBRSxDQUFYLEVBQWNBLElBQUlFLEtBQUtELE1BQXZCLEVBQStCRCxHQUEvQixFQUFvQztBQUNsQ1IsNkJBQXlCQyxNQUF6QixFQUFpQ1MsS0FBS0YsQ0FBTCxDQUFqQztBQUNBUCxXQUFPRyxNQUFQLENBQWMsSUFBZCxFQUFvQixNQUFwQjtBQUNBSiw2QkFBeUJDLE1BQXpCLEVBQWlDQyxNQUFNUSxLQUFLRixDQUFMLENBQU4sQ0FBakM7QUFDQVAsV0FBT0csTUFBUCxDQUFjLEdBQWQsRUFBbUIsTUFBbkI7QUFDRDs7QUFFREgsU0FBT0csTUFBUCxDQUFjLEdBQWQsRUFBbUIsTUFBbkI7QUFDRDs7QUFHRDs7Ozs7QUFLZSxTQUFTTCxxQkFBVCxDQUErQmMsR0FBL0IsRUFBb0M7QUFDakQsTUFBSUMsT0FBTyxpQkFBT0MsVUFBUCxDQUFrQixNQUFsQixDQUFYO0FBQ0FmLDJCQUF5QmMsSUFBekIsRUFBK0JELEdBQS9COztBQUVBLFNBQU9DLEtBQUtFLE1BQUwsQ0FBWSxLQUFaLENBQVA7QUFDRCIsImZpbGUiOiJkaWdlc3QtZm9yLW9iamVjdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBjcnlwdG8gZnJvbSAnY3J5cHRvJztcblxuZnVuY3Rpb24gdXBkYXRlRGlnZXN0Rm9ySnNvblZhbHVlKHNoYXN1bSwgdmFsdWUpIHtcbiAgLy8gSW1wbG1lbnRhdGlvbiBpcyBzaW1pbGFyIHRvIHRoYXQgb2YgcHJldHR5LXByaW50aW5nIGEgSlNPTiBvYmplY3QsIGV4Y2VwdDpcbiAgLy8gKiBTdHJpbmdzIGFyZSBub3QgZXNjYXBlZC5cbiAgLy8gKiBObyBlZmZvcnQgaXMgbWFkZSB0byBhdm9pZCB0cmFpbGluZyBjb21tYXMuXG4gIC8vIFRoZXNlIHNob3J0Y3V0cyBzaG91bGQgbm90IGFmZmVjdCB0aGUgY29ycmVjdG5lc3Mgb2YgdGhpcyBmdW5jdGlvbi5cbiAgY29uc3QgdHlwZSA9IHR5cGVvZih2YWx1ZSk7XG5cbiAgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgc2hhc3VtLnVwZGF0ZSgnXCInLCAndXRmOCcpO1xuICAgIHNoYXN1bS51cGRhdGUodmFsdWUsICd1dGY4Jyk7XG4gICAgc2hhc3VtLnVwZGF0ZSgnXCInLCAndXRmOCcpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICh0eXBlID09PSAnYm9vbGVhbicgfHwgdHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICBzaGFzdW0udXBkYXRlKHZhbHVlLnRvU3RyaW5nKCksICd1dGY4Jyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCF2YWx1ZSkge1xuICAgIHNoYXN1bS51cGRhdGUoJ251bGwnLCAndXRmOCcpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHNoYXN1bS51cGRhdGUoJ1snLCAndXRmOCcpO1xuICAgIGZvciAobGV0IGk9MDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICB1cGRhdGVEaWdlc3RGb3JKc29uVmFsdWUoc2hhc3VtLCB2YWx1ZVtpXSk7XG4gICAgICBzaGFzdW0udXBkYXRlKCcsJywgJ3V0ZjgnKTtcbiAgICB9XG4gICAgc2hhc3VtLnVwZGF0ZSgnXScsICd1dGY4Jyk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Q6IGJlIHN1cmUgdG8gc29ydCB0aGUga2V5cy5cbiAgbGV0IGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIGtleXMuc29ydCgpO1xuXG4gIHNoYXN1bS51cGRhdGUoJ3snLCAndXRmOCcpO1xuXG4gIGZvciAobGV0IGk9MDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICB1cGRhdGVEaWdlc3RGb3JKc29uVmFsdWUoc2hhc3VtLCBrZXlzW2ldKTtcbiAgICBzaGFzdW0udXBkYXRlKCc6ICcsICd1dGY4Jyk7XG4gICAgdXBkYXRlRGlnZXN0Rm9ySnNvblZhbHVlKHNoYXN1bSwgdmFsdWVba2V5c1tpXV0pO1xuICAgIHNoYXN1bS51cGRhdGUoJywnLCAndXRmOCcpO1xuICB9XG5cbiAgc2hhc3VtLnVwZGF0ZSgnfScsICd1dGY4Jyk7XG59XG5cblxuLyoqXG4gKiBDcmVhdGVzIGEgaGFzaCBmcm9tIGEgSlMgb2JqZWN0XG4gKiBcbiAqIEBwcml2YXRlICBcbiAqLyBcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGNyZWF0ZURpZ2VzdEZvck9iamVjdChvYmopIHtcbiAgbGV0IHNoYTEgPSBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMScpO1xuICB1cGRhdGVEaWdlc3RGb3JKc29uVmFsdWUoc2hhMSwgb2JqKTtcbiAgXG4gIHJldHVybiBzaGExLmRpZ2VzdCgnaGV4Jyk7XG59XG4iXX0=