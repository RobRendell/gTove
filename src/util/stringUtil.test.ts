import chai from 'chai';

import {compareAlphanumeric} from './stringUtils';

describe('stringUtil', () => {

    describe('compareAlphanumeric function', () => {

        it('should put numbers after strings, and sort numbers by value', () => {
            const list = ['a string', '123', 'zzz', '9', '1.555', '1.02'];
            const result = list.slice().sort(compareAlphanumeric);
            chai.assert.equal(result[0], list[0], 'index 0');
            chai.assert.equal(result[1], list[2], 'index 1');
            chai.assert.equal(result[2], list[5], 'index 2');
            chai.assert.equal(result[3], list[4], 'index 3');
            chai.assert.equal(result[4], list[3], 'index 4');
            chai.assert.equal(result[5], list[1], 'index 5');
        });

        it('should sort numerically in the middle of the string', () => {
            const list = ['Goblin 11', 'Goblin 2', 'Goblin Captain', 'Warg'];
            const result = list.slice().sort(compareAlphanumeric);
            chai.assert.equal(result[0], list[1], 'index 0');
            chai.assert.equal(result[1], list[0], 'index 1');
            chai.assert.equal(result[2], list[2], 'index 2');
            chai.assert.equal(result[3], list[3], 'index 3');
        });

        it('should sort empty strings to the end', () => {
            const list = ['', 'Fighter', '', 'Warrior'];
            const result = list.slice().sort(compareAlphanumeric);
            chai.assert.equal(result[0], list[1], 'index 0');
            chai.assert.equal(result[1], list[3], 'index 1');
            chai.assert.equal(result[2], list[0], 'index 2');
            chai.assert.equal(result[3], list[2], 'index 3');
        });

    })

});