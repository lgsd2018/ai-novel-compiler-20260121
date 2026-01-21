
export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export const Diff = {
  diffLines: (oldText: string, newText: string): DiffPart[] => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const result: DiffPart[] = [];
    
    // Simple LCS-based diff or just a basic line-by-line comparison for now.
    // For a robust implementation without external deps, we can use a simple greedy approach 
    // or just mark everything as changed if it's too complex.
    // Let's implement a simplified Myers diff algorithm.
    
    // Matrix for LCS
    const matrix: number[][] = [];
    for (let i = 0; i <= oldLines.length; i++) {
      matrix[i] = new Array(newLines.length + 1).fill(0);
    }

    for (let i = 1; i <= oldLines.length; i++) {
      for (let j = 1; j <= newLines.length; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }

    // Backtrack to find diff
    const diff: DiffPart[] = [];
    let i = oldLines.length;
    let j = newLines.length;

    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        diff.unshift({ value: oldLines[i - 1] + '\n' });
        i--;
        j--;
      } else if (matrix[i - 1][j] > matrix[i][j - 1]) {
        diff.unshift({ value: oldLines[i - 1] + '\n', removed: true });
        i--;
      } else {
        diff.unshift({ value: newLines[j - 1] + '\n', added: true });
        j--;
      }
    }

    while (i > 0) {
      diff.unshift({ value: oldLines[i - 1] + '\n', removed: true });
      i--;
    }

    while (j > 0) {
      diff.unshift({ value: newLines[j - 1] + '\n', added: true });
      j--;
    }

    // Merge consecutive parts of same type
    const merged: DiffPart[] = [];
    if (diff.length > 0) {
      let current = diff[0];
      for (let k = 1; k < diff.length; k++) {
        const next = diff[k];
        if (current.added === next.added && current.removed === next.removed) {
          current.value += next.value;
        } else {
          merged.push(current);
          current = next;
        }
      }
      merged.push(current);
    }

    return merged;
  }
};
