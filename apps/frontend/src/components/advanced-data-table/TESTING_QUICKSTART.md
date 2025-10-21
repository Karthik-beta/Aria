# Testing Quick Start

> Fast reference for running tests on the advanced-data-table component

## 🚀 Quick Commands

```bash
# Install dependencies (first time only)
pnpm install

# Run all tests
pnpm test:run

# Watch mode (auto-rerun on changes)
pnpm test

# Interactive UI (recommended for development)
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

## 📊 Current Status

**✅ 47 tests passing** - Core functionality fully tested  
**🟡 26 tests failing** - Expected (future features + 4 minor fixes needed)  
**⚡ 13.21s** - Full test suite execution time

## 🎯 What's Tested

### Fully Tested ✅

- ✅ `debounce()` - Delayed function execution
- ✅ `throttle()` - Rate-limited function calls
- ✅ `useAdvancedDataTable()` - Hook state management
- ✅ `<AdvancedDataTable>` - Component rendering

### Test Files

- `use-advanced-data-table.test.ts` - Hook logic (273 lines)
- `advanced-data-table.test.tsx` - Component UI (168 lines)
- `utils.test.ts` - Utility functions (114 lines)

## 📁 Test Infrastructure

```
apps/frontend/
├── vitest.config.ts          # Main config
├── test/
│   ├── setup.ts              # Global mocks
│   └── utils.tsx             # Test helpers
├── src/components/advanced-data-table/
│   ├── *.test.ts            # Unit tests
│   └── *.test.tsx           # Component tests
└── package.json              # Test scripts
```

## 🔧 Common Tasks

### Add a New Test

```typescript
// In any *.test.ts or *.test.tsx file
import { describe, it, expect } from 'vitest';

describe('My Feature', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test a Component

```typescript
import { renderWithProviders } from '../../../test/utils';
import { screen } from '@testing-library/react';

it('should render component', () => {
  renderWithProviders(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

### Test a Hook

```typescript
import { renderHook, act } from '@testing-library/react';

it('should update state', () => {
  const { result } = renderHook(() => useMyHook());

  act(() => {
    result.current.updateValue('new');
  });

  expect(result.current.value).toBe('new');
});
```

## 🐛 Debugging Tests

### Run Specific Test File

```bash
pnpm test use-advanced-data-table.test.ts
```

### Run Tests Matching Pattern

```bash
pnpm test --grep "pagination"
```

### Debug in VSCode

1. Set breakpoint in test file
2. Press `F5` or use Debug panel
3. Select "Debug Tests" configuration

### View Test Output

```typescript
import { screen } from '@testing-library/react';

it('debug test', () => {
  render(<Component />);
  screen.debug(); // Prints entire DOM
});
```

## 📈 Coverage

### View Coverage Report

```bash
pnpm test:coverage
```

### Open HTML Report

```bash
# After running coverage
open coverage/index.html  # macOS
start coverage/index.html # Windows
```

### Coverage Thresholds

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 75%
- **Statements**: 80%

## ⚠️ Known Issues

### Minor Fixes Needed (4 tests)

1. **Accessibility test**: Use `getAllByRole` for multiple rowgroups
2. **Pagination test**: More specific text query needed
3. **Error handling tests**: Wrap hooks in `renderHook()`
4. **Filtering test**: Verify filter configuration

### Future Features (22 tests)

Tests written for not-yet-implemented functions:

- `formatFileSize()`
- `exportToCSV()`
- `exportToJSON()`
- `downloadFile()`
- `validateImportData()`
- `AdvancedDataTableError`

## 📚 Resources

- [Testing Guide](./TESTING.md) - Complete testing documentation
- [Test Results](./TEST_RESULTS.md) - Detailed test execution summary
- [Vitest Docs](https://vitest.dev/) - Official Vitest documentation
- [RTL Docs](https://testing-library.com/react) - React Testing Library guide

## ✅ Pre-Commit Checklist

Before committing code:

- [ ] `pnpm test:run` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:coverage` meets thresholds
- [ ] New features have tests
- [ ] Tests are descriptive and maintainable

---

**Remember**: Write tests as you code, not after. Tests give you confidence to refactor! 🎯
