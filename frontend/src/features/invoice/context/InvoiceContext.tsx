import { createContext, useContext, useReducer } from 'react';
import { useLocation } from 'react-router-dom';
import { INITIAL_CATS } from '@/features/invoice/constants/categories';
import { INITIAL_SM_STATE } from '@/features/invoice/constants/socialMedia';
import { todayISO } from '@/features/invoice/utils/format';

export const initialState = {
  docType:     'FACTURE',
  docNum:      '',
  docDate:     '',
  fixDocument: false,

  email:   'antigoneconsulting.info@gmail.com',
  address: '012, RUE HABIB THAMEUR, RADES 2040',

  currentClient: null as any,

  cats:          INITIAL_CATS.map((c: any) => ({ ...c, selected: [], _open: false })),
  svcTitle:      'Social Media Management',
  svcSubtitle:   'Habillage des réseaux sociaux',
  selectedSM:    { ...INITIAL_SM_STATE },
  emptyBarCount: 0,
  savedServiceIds: {} as Record<string, string>,

  iHT:     0,
  iTVA:    19,
  iTimbre: 1,

  lastNumbers: { facture: '', devis: '' } as Record<string, string>,

  isLocked: false,

  showSaveDialog: false,
  showTplModal:   false,
  showDashboard:  false,
  showStamp:      false,

  activeReminder:   null as any,
  reminderExpanded: false,
};

type State = typeof initialState;

export function reducer(state: State, action: any): State {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.key]: action.value };

    case 'SET_DOC_TYPE': {
      const t      = action.value === 'Devis' ? 'devis' : 'facture';
      const last   = state.lastNumbers[t] || '';
      const parts  = last.split('-');
      const year   = new Date().getFullYear().toString();
      const seq    = parseInt(parts[1], 10);
      const docNum = (parts[0] === year && !isNaN(seq))
        ? `${year}-${seq + 1}`
        : `${year}-1`;
      return { ...state, docType: action.value, docNum };
    }

    case 'SET_CATS':
      return { ...state, cats: action.value };

    case 'UPDATE_CAT_SELECTED':
      return {
        ...state,
        cats: state.cats.map((c: any) =>
          c.id === action.catId ? { ...c, selected: action.selected } : c,
        ),
      };

    case 'TOGGLE_CAT_OPEN':
      return {
        ...state,
        cats: state.cats.map((c: any) => ({
          ...c,
          _open: c.id === action.catId ? !c._open : false,
        })),
      };

    case 'ADD_TO_LIBRARY':
      return {
        ...state,
        cats: state.cats.map((c: any) =>
          c.id === action.catId
            ? { ...c, library: [...c.library, action.name] }
            : c,
        ),
        savedServiceIds: {
          ...state.savedServiceIds,
          [`${action.catId}:${action.name}`]: action.uuid,
        },
      };

    case 'UPDATE_IN_LIBRARY':
      return {
        ...state,
        cats: state.cats.map((c: any) => {
          if (c.id !== action.catId) return c;
          return {
            ...c,
            library: c.library.map((n: string) => (n === action.oldName ? action.newName : n)),
            selected: c.selected.map((s: any) =>
              s.name === action.oldName ? { ...s, name: action.newName } : s,
            ),
          };
        }),
        savedServiceIds: (() => {
          const updated = { ...state.savedServiceIds };
          const key = `${action.catId}:${action.oldName}`;
          if (updated[key]) {
            updated[`${action.catId}:${action.newName}`] = updated[key];
            delete updated[key];
          }
          return updated;
        })(),
      };

    case 'REMOVE_FROM_LIBRARY':
      return {
        ...state,
        cats: state.cats.map((c: any) => {
          if (c.id !== action.catId) return c;
          return {
            ...c,
            library:  c.library.filter((n: string) => n !== action.name),
            selected: c.selected.filter((s: any) => s.name !== action.name),
          };
        }),
        savedServiceIds: (() => {
          const updated = { ...state.savedServiceIds };
          delete updated[`${action.catId}:${action.name}`];
          return updated;
        })(),
      };

    case 'MERGE_SAVED_SERVICES': {
      const newIds = { ...state.savedServiceIds };
      const newCats = state.cats.map((c: any) => {
        const rows = action.rows.filter((r: any) => r.category_id === c.id);
        const newNames = rows
          .map((r: any) => r.name)
          .filter((n: string) => !c.library.includes(n));
        rows.forEach((r: any) => { newIds[`${c.id}:${r.name}`] = r.id; });
        return { ...c, library: [...c.library, ...newNames] };
      });
      return { ...state, cats: newCats, savedServiceIds: newIds };
    }

    case 'TOGGLE_SM':
      return {
        ...state,
        selectedSM: { ...state.selectedSM, [action.key]: !(state.selectedSM as any)[action.key] },
      };

    case 'SET_PRICING':
      return { ...state, [action.key]: action.value };

    case 'SET_LAST_NUMBERS':
      return { ...state, lastNumbers: { ...state.lastNumbers, ...action.value } };

    case 'UNLOCK_NUM':
      return { ...state, isLocked: false };

    case 'TOGGLE_SAVE_DIALOG':
      return { ...state, showSaveDialog: !state.showSaveDialog };
    case 'TOGGLE_TPL_MODAL':
      return { ...state, showTplModal: !state.showTplModal };
    case 'TOGGLE_DASHBOARD':
      return { ...state, showDashboard: !state.showDashboard };

    case 'SET_ACTIVE_REMINDER':
      return { ...state, activeReminder: action.value, reminderExpanded: false };
    case 'SET_REMINDER_EXPANDED':
      return { ...state, reminderExpanded: action.value };

    case 'RESET_ALL':
      return {
        ...initialState,
        lastNumbers:     state.lastNumbers,
        savedServiceIds: state.savedServiceIds,
        cats:    state.cats.map((c: any) => ({ ...c, selected: [], _open: false })),
        docDate: todayISO(),
      };

    case 'RESET_SERVICES':
      return {
        ...state,
        cats: state.cats.map((c: any) => ({ ...c, selected: [], _open: false })),
        emptyBarCount: 0,
        selectedSM: { ...INITIAL_SM_STATE },
      };

    case 'APPLY_TEMPLATE':
      return { ...state, ...action.state };

    default:
      return state;
  }
}

export const InvoiceContext = createContext<{ state: State; dispatch: React.Dispatch<any> } | null>(null);

export function InvoiceProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const locState = (location.state as { editNum?: string; invoicePayload?: any } | null);
  const editNum = locState?.editNum;
  const invoicePayload = locState?.invoicePayload;

  const [state, dispatch] = useReducer(reducer, { editNum, invoicePayload }, ({ editNum, invoicePayload }) => {
    if (invoicePayload) {
      // Restore full invoice state from payload (edit mode with services)
      return {
        ...initialState,
        ...invoicePayload,
        // Ensure cats have _open: false (not serialized correctly)
        cats: Array.isArray(invoicePayload.cats)
          ? invoicePayload.cats.map((c: any) => ({ ...c, _open: false }))
          : initialState.cats.map((c: any) => ({ ...c, selected: [], _open: false })),
        docNum:   editNum ?? invoicePayload.docNum ?? '',
        isLocked: !!editNum,
      };
    }
    return {
      ...initialState,
      docNum:   editNum ?? '',
      isLocked: !!editNum,
    };
  });
  return (
    <InvoiceContext.Provider value={{ state, dispatch }}>
      {children}
    </InvoiceContext.Provider>
  );
}

export function useInvoice() {
  const ctx = useContext(InvoiceContext);
  if (!ctx) throw new Error('useInvoice must be used inside InvoiceProvider');
  return ctx;
}
