type Cell = {
    row: number;
    col: number;
};

/**
 * 按成品生成开局。外形和每种颜色的颗数不变。
 * 颗数最多的颜色铺满剩下的格子，其余颜色收成方块，并尽量不放在成品的位置上。
 * @param target 成品，`.` 是空孔
 */
export function scrambleLevel(target: readonly string[]): string[] {
    const rowCount = target.length;
    if (rowCount === 0) return [];
    const colCount = target[0]?.length ?? 0;
    const occupied: Cell[] = [];
    const counts = new Map<string, number>();
    let rowMin = rowCount;
    let rowMax = -1;
    let colMin = colCount;
    let colMax = -1;

    for (let row = 0; row < rowCount; row++) {
        const line = target[row] ?? '';
        for (let col = 0; col < colCount; col++) {
            const color = line.charAt(col);
            if (color === '.' || color === '') continue;
            occupied.push({ row, col });
            counts.set(color, (counts.get(color) ?? 0) + 1);
            if (row < rowMin) rowMin = row;
            if (row > rowMax) rowMax = row;
            if (col < colMin) colMin = col;
            if (col > colMax) colMax = col;
        }
    }

    const result = target.map(line => line.split(''));
    if (occupied.length === 0) {
        return result.map(line => line.join(''));
    }

    // Creator 的小游戏构建会把迭代器的数组展开编译为 concat，需显式转为数组。
    const colors = Array.from(counts.keys()).sort((left, right) => {
        const byCount = (counts.get(right) ?? 0) - (counts.get(left) ?? 0);
        if (byCount !== 0) return byCount;
        if (left < right) return -1;
        if (left > right) return 1;
        return 0;
    });
    const filler = colors[0] ?? '';
    const accents = colors.slice(1);
    const shortSide = Math.min(rowMax - rowMin + 1, colMax - colMin + 1);
    const side = Math.max(2, Math.round(shortSide / 3));
    const capacity = side * side;
    const free = new Set(occupied.map(cell => keyOf(cell.row, cell.col)));
    const anchors = anchorPoints(rowMin, rowMax, colMin, colMax);
    let anchorIndex = 0;

    const readTarget = (row: number, col: number) => (target[row] ?? '').charAt(col);

    const takeNearest = (anchor: Cell, color: string): Cell | null => {
        let best: Cell | null = null;
        let bestWrong = 2;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const id of free) {
            const cell = parseKey(id);
            const wrong = readTarget(cell.row, cell.col) === color ? 1 : 0;
            const distance = Math.abs(cell.row - anchor.row) + Math.abs(cell.col - anchor.col);
            if (
                wrong < bestWrong ||
                (wrong === bestWrong && distance < bestDistance) ||
                (wrong === bestWrong && distance === bestDistance && (best === null ||
                    cell.row < best.row ||
                    (cell.row === best.row && cell.col < best.col)))
            ) {
                best = cell;
                bestWrong = wrong;
                bestDistance = distance;
            }
        }
        return best;
    };

    const grow = (start: Cell, color: string, size: number): number => {
        const placed: Cell[] = [start];
        free.delete(keyOf(start.row, start.col));
        result[start.row][start.col] = color;
        let count = 1;
        while (count < size) {
            let next: Cell | null = null;
            let nextWrong = 2;
            let nextDistance = Number.POSITIVE_INFINITY;
            const seen = new Set<string>();
            for (const cell of placed) {
                for (const neighbor of orthogonal(cell)) {
                    const id = keyOf(neighbor.row, neighbor.col);
                    if (!free.has(id) || seen.has(id)) continue;
                    seen.add(id);
                    const wrong = readTarget(neighbor.row, neighbor.col) === color ? 1 : 0;
                    const distance = Math.abs(neighbor.row - start.row) + Math.abs(neighbor.col - start.col);
                    if (
                        wrong < nextWrong ||
                        (wrong === nextWrong && distance < nextDistance) ||
                        (wrong === nextWrong && distance === nextDistance && (next === null ||
                            neighbor.row < next.row ||
                            (neighbor.row === next.row && neighbor.col < next.col)))
                    ) {
                        next = neighbor;
                        nextWrong = wrong;
                        nextDistance = distance;
                    }
                }
            }
            if (!next) break;
            free.delete(keyOf(next.row, next.col));
            result[next.row][next.col] = color;
            placed.push(next);
            count += 1;
        }
        return count;
    };

    for (const color of accents) {
        let left = counts.get(color) ?? 0;
        while (left > 0) {
            let size = Math.min(left, capacity);
            const rest = left - size;
            if (rest > 0 && rest * 2 < capacity) size = left;
            const anchor = anchors[anchorIndex % anchors.length] ?? anchors[0];
            anchorIndex += 1;
            let placed = 0;
            let guard = left;
            while (placed < size && guard > 0) {
                const start = takeNearest(anchor, color);
                if (!start) break;
                const grown = grow(start, color, size - placed);
                if (grown === 0) break;
                placed += grown;
                guard -= grown;
            }
            if (placed === 0) break;
            left -= placed;
        }
    }

    for (const id of free) {
        const cell = parseKey(id);
        result[cell.row][cell.col] = filler;
    }
    return result.map(line => line.join(''));
}

function anchorPoints(rowMin: number, rowMax: number, colMin: number, colMax: number): Cell[] {
    const midRow = Math.round((rowMin + rowMax) / 2);
    const midCol = Math.round((colMin + colMax) / 2);
    return [
        { row: rowMin, col: midCol },
        { row: rowMax, col: colMin },
        { row: rowMax, col: colMax },
        { row: rowMin, col: colMax },
        { row: midRow, col: midCol },
        { row: rowMax, col: midCol },
        { row: rowMin, col: colMin },
        { row: midRow, col: colMin },
        { row: midRow, col: colMax }
    ];
}

function orthogonal(cell: Cell): Cell[] {
    return [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 }
    ];
}

function keyOf(row: number, col: number): string {
    return `${row},${col}`;
}

function parseKey(id: string): Cell {
    const [row, col] = id.split(',');
    return { row: Number(row), col: Number(col) };
}
