/* The sample storyboard: Plant Pal, an iPhone app composed the way @brett_lamy/ui apps are — a TabView whose tabs
   are NavigationStacks of list screens, sheets that are NavigationStacks of their own. All of it is invented.

     Welcome ──modal──▶ SignInNav ⊟ SignIn ──replace──▶ MainTabs (TabView)
                                                          ├⊟ GardenNav (NavigationStack) ⊟ Garden ──push──▶ PlantDetail
                                                          │                                  └──modal──▶ AddPlantNav ⊟ AddPlant
                                                          ├⊟ Schedule
                                                          └⊟ SettingsNav (NavigationStack) ⊟ Settings
   (⊟ is a relationship: a container showing a scene.)

   - Welcome: its stack staggers the hero, title and button in; the button sinks when pressed.
   - SignIn (in a sheet with its own NavigationStack): state bound two-way to the fields; a memo; the email field is
     an outlet that becomes the first responder and shakes when sign-in fails; Return in it focuses the password
     field's outlet; Return in the password field sends `submit` up the responder chain, which the scene handles;
     signing in sets a context field and replaces the app's root with MainTabs. Cancel (its bar item) dismisses.
   - Garden: reads the session context; a ListSection repeats a prototype row over `plants` state; a row pushes
     PlantDetail onto the NavigationStack with the plant as a prop (prepare(for:)); the + bar item presents AddPlant.
   - PlantDetail: `onWater` is a callback prop Garden implements on the segue (its delegate); the heart's variant
     follows state.
   - AddPlant hands the new plant to `onAdd`; AddPlantNav forwards it up (a callback prop through a container). */
import { makeNode } from './catalog';
import { physicsSpec, springSpec, tweenSpec } from './easing';
import type { Action, ActionInit, Doc, Node, Scene } from './model';

const T = {
  snappy: physicsSpec(620, 48),
  bouncy: springSpec(0.5, 0.45),
  pop: springSpec(0.55, 0.32),
  rise: springSpec(0.6, 0.2),
};

let seq = 0;
const act = (a: ActionInit): Action => ({ id: `act-${++seq}`, ...a } as Action);
const n = (type: string, patch: Partial<Node>): Node => makeNode(type, patch);
const rise = (y = 18) => ({ appear: { target: { opacity: 0, y }, transition: T.rise, trigger: 'mount' as const, once: true } });
const text = (id: string, children: string, textStyle: string, patch: Partial<Node> = {}) => n('Text', { id, ...patch, props: { children, textStyle, ...patch.props } });

/** A scene with nothing but a view. */
const scene = (id: string, name: string, x: number, y: number, root: Node, more: Partial<Scene> = {}): Scene => ({
  id, name, x, y, props: [], state: [], memos: [], effects: [], background: null, root, ...more,
});

/** A container scene: a NavigationStack showing one scene. */
const navOf = (id: string, name: string, x: number, y: number, child: string, more: Partial<Scene> = {}, ref: Partial<Node> = {}) =>
  scene(id, name, x, y, n('NavigationStack', { id: `${id}-root`, children: [n('SceneRef', { id: `${id}-ref`, props: { scene: child }, ...ref })] }), more);

const COL = 560, ROW = 1100;

/* ── Welcome ── */

const welcome = scene('welcome', 'Welcome', 0, 0, n('Screen', {
  id: 'welcome-root',
  props: { title: 'Welcome', largeTitle: false },
  layout: { axis: 'vertical', gap: 18, padding: [24, 28, 28, 28], align: 'center', distribute: 'start', width: 'fill', height: 'fill' },
  motion: { stagger: { each: 0.09, delay: 0.1, from: 'first' } },
  children: [
    n('Spacer', { id: 'welcome-top' }),
    n('Image', {
      id: 'welcome-hero', name: 'Hero',
      props: { emoji: '🪴', from: '#A8E063', to: '#56AB2F' },
      layout: { width: 132, height: 132 },
      style: { radius: 38, shadow: 'lg' },
      motion: { appear: { target: { opacity: 0, scale: [0.5, 1.08] }, transition: tweenSpec(0.7, [0.22, 1, 0.36, 1]), trigger: 'mount', once: true } },
    }),
    text('welcome-title', 'Plant Pal', 'largeTitle', { props: { align: 'center' }, layout: { width: 'fit' }, motion: rise() }),
    text('welcome-copy', 'Water on time, every time.\nYour garden, remembered.', 'body', { props: { align: 'center', color: '$muted-foreground' }, layout: { width: 'fit' }, motion: rise() }),
    n('Spacer', { id: 'welcome-gap' }),
    n('Button', {
      id: 'get-started', name: 'Get Started',
      props: { children: 'Get Started', size: 'pill' },
      layout: { width: 'fill' },
      motion: { ...rise(28), press: { target: { scale: 0.96 }, transition: T.snappy } },
      on: { onPress: [act({ do: 'segue', segue: 'to-sign-in' })] },
    }),
    text('welcome-legal', 'No account needed for the demo: any email works.', 'footnote', { props: { align: 'center', color: '$muted-foreground' }, layout: { width: 'fit' }, motion: rise() }),
  ],
}));

/* ── Sign in, in its own NavigationStack (a sheet) ── */

const signInNav = navOf('sign-in-nav', 'SignInNav', COL, 0, 'sign-in');

const signIn = scene('sign-in', 'SignIn', COL * 2, 0, n('Screen', {
  id: 'sign-in-root',
  props: { title: 'Sign In', largeTitle: false },
  layout: { axis: 'vertical', gap: 16, padding: [8, 20, 24, 20], align: 'start', distribute: 'start', width: 'fill', height: 'fill' },
  motion: { stagger: { each: 0.06, delay: 0.05, from: 'first' } },
  slots: {
    leading: [n('Button', { id: 'sign-in-cancel', props: { children: 'Cancel', variant: 'link', size: 'default' }, on: { onPress: [act({ do: 'back' })] } })],
    trailing: [],
  },
  children: [
    text('sign-in-title', 'Welcome back', 'title1', { motion: rise(12) }),
    text('sign-in-copy', 'Sign in to see what needs water today.', 'subhead', { props: { color: '$muted-foreground' }, motion: rise(12) }),
    n('TextField', {
      id: 'email-field', name: 'Email Field', ref: 'emailField', autoFocus: true,
      props: { label: 'Email', placeholder: 'you@example.com', type: 'email' },
      bind: { value: 'email', isInvalid: "attempted && !email.includes('@')" },
      motion: { ...rise(12), variants: { shake: { target: { x: [0, -12, 11, -8, 6, -3, 0] }, transition: tweenSpec(0.5, 'easeOut') } } },
      on: { onSubmit: [act({ do: 'focus', ref: 'passwordField' })] },
    }),
    n('TextField', {
      id: 'password-field', name: 'Password Field', ref: 'passwordField',
      props: { label: 'Password', placeholder: 'At least 4 characters', type: 'password' },
      bind: { value: 'password' },
      motion: rise(12),
      on: { onSubmit: [act({ do: 'send', command: 'submit' })] },
    }),
    text('sign-in-error', 'Enter an email and a password of 4 or more characters.', 'footnote', {
      props: { color: '$destructive' },
      when: 'attempted && !canSignIn',
      motion: { appear: { target: { opacity: 0, y: -6 }, transition: T.snappy, trigger: 'mount', once: true }, exit: { target: { opacity: 0, y: -6 }, transition: tweenSpec(0.14, [0.4, 0, 1, 1]) } },
    }),
    n('Spacer', { id: 'sign-in-gap' }),
    n('Button', {
      id: 'sign-in-button',
      props: { children: 'Sign In', size: 'pill' },
      layout: { width: 'fill' },
      motion: { ...rise(20), press: { target: { scale: 0.96 }, transition: T.snappy } },
      on: { onPress: [act({ do: 'send', command: 'submit' })] },
    }),
  ],
}), {
  state: [
    { name: 'email', type: 'string', initial: "''" },
    { name: 'password', type: 'string', initial: "''" },
    { name: 'attempted', type: 'boolean', initial: 'false' },
  ],
  memos: [{ name: 'canSignIn', expr: "email.includes('@') && password.length >= 4" }],
  responds: {
    submit: [
      act({ do: 'set', target: 'attempted', value: 'true' }),
      act({ do: 'animate', ref: 'emailField', variant: 'shake', if: '!canSignIn' }),
      act({ do: 'set', target: 'session.user', value: 'email', if: 'canSignIn' }),
      act({ do: 'segue', segue: 'to-main', if: 'canSignIn' }),
    ],
  },
});

/* ── The app: a TabView of NavigationStacks ── */

const mainTabs = scene('main', 'MainTabs', COL, ROW, n('TabView', {
  id: 'main-root',
  props: { tabs: 'Garden:flower, Schedule:calendar, Settings:gear', selectedKey: 'Garden' },
  bind: { selectedKey: 'tab' },
  children: [
    n('SceneRef', { id: 'tab-garden', props: { scene: 'garden-nav' } }),
    n('SceneRef', { id: 'tab-schedule', props: { scene: 'schedule' } }),
    n('SceneRef', { id: 'tab-settings', props: { scene: 'settings-nav' } }),
  ],
}), { state: [{ name: 'tab', type: 'string', initial: "'Garden'" }] });

const gardenNav = navOf('garden-nav', 'GardenNav', COL * 2, ROW, 'garden');

const PLANTS = `[
  { id: 1, name: 'Monstera', emoji: '🪴', every: 7, watered: false },
  { id: 2, name: 'Fiddle Leaf Fig', emoji: '🌳', every: 10, watered: true },
  { id: 3, name: 'Snake Plant', emoji: '🌵', every: 14, watered: false },
  { id: 4, name: 'Golden Pothos', emoji: '🌿', every: 5, watered: false }
]`;

const garden = scene('garden', 'Garden', COL * 3, ROW, n('Screen', {
  id: 'garden-root',
  props: { title: 'My Garden', largeTitle: true, grouped: true },
  layout: { axis: 'vertical', gap: 14, padding: [4, 16, 96, 16], align: 'start', distribute: 'start', width: 'fill', height: 'fill' },
  motion: { stagger: { each: 0.06, delay: 0.05, from: 'first' } },
  slots: {
    leading: [],
    trailing: [n('Button', {
      id: 'add-plant', name: 'Add Button',
      props: { children: 'Add Plant', variant: 'ghost', size: 'icon', icon: 'plus' },
      motion: { press: { target: { scale: 0.86, rotate: 90 }, transition: T.bouncy } },
      on: { onPress: [act({ do: 'segue', segue: 'to-add' })] },
    })],
  },
  children: [
    text('greeting', 'Good morning', 'subhead', {
      props: { color: '$muted-foreground' },
      bind: { children: "`Good morning, ${session.user ? session.user.split('@')[0] : 'gardener'} ☀️`" },
      motion: rise(10),
    }),
    n('Card', {
      id: 'today-card',
      props: { variant: 'default' },
      layout: { axis: 'horizontal', gap: 14, padding: 16, align: 'center', width: 'fill' },
      motion: rise(16),
      children: [
        n('ProgressRing', { id: 'today-ring', props: { size: 56, showValue: true }, bind: { value: 'Math.round(watered / Math.max(plants.length, 1) * 100)' } }),
        n('Stack', {
          id: 'today-text',
          layout: { axis: 'vertical', gap: 2, align: 'start', width: 'fill' },
          children: [
            text('today-title', 'Today', 'headline'),
            text('today-count', '1 of 4 watered', 'footnote', { props: { color: '$muted-foreground' }, bind: { children: '`${watered} of ${plants.length} watered`' } }),
          ],
        }),
        n('Button', {
          id: 'water-all',
          props: { children: 'Water All', size: 'sm', variant: 'secondary' },
          bind: { isDisabled: 'watered === plants.length' },
          motion: { press: { target: { scale: 0.94 }, transition: T.snappy } },
          on: { onPress: [act({ do: 'set', target: 'plants', value: 'plants.map((p) => ({ ...p, watered: true }))' }), act({ do: 'toast', message: "'Everything’s watered 💧'" })] },
        }),
      ],
    }),
    n('ListSection', {
      id: 'plant-list',
      props: { title: 'Plants' },
      bind: { footer: '`${plants.length} plants · tap one for details`' },
      motion: { stagger: { each: 0.05, delay: 0, from: 'first' } },
      children: [
        n('ListRow', {
          id: 'plant-row', name: 'Plant Cell',
          props: { title: 'Plant', subtitle: 'Every 7 days', accessory: 'chevron' },
          bind: { title: 'plant.name', subtitle: "plant.watered ? 'Watered today' : `Every ${plant.every} days`" },
          repeat: { each: 'plants', as: 'plant', key: 'plant.id' },
          motion: { appear: { target: { opacity: 0, x: 28 }, transition: T.rise, trigger: 'mount', once: true }, exit: { target: { opacity: 0, x: -28 }, transition: tweenSpec(0.2, 'easeIn') } },
          on: { onPress: [act({ do: 'segue', segue: 'to-plant' })] },
          slots: {
            leading: [n('Image', {
              id: 'plant-thumb',
              props: { emoji: '🪴', from: '#A8E063', to: '#56AB2F' },
              bind: { emoji: 'plant.emoji' },
              layout: { width: 40, height: 40 },
              style: { radius: 11 },
              motion: { layoutId: '`plant-${plant.id}`' },
            })],
            accessory: [],
          },
        }),
      ],
    }),
  ],
}), {
  state: [{ name: 'plants', type: 'list', initial: PLANTS }],
  memos: [{ name: 'watered', expr: 'plants.filter((p) => p.watered).length' }],
});

const plantDetail = scene('plant', 'PlantDetail', COL * 4, ROW, n('Screen', {
  id: 'plant-root',
  props: { title: 'Plant', largeTitle: false },
  bind: { title: 'plant.name' },
  layout: { axis: 'vertical', gap: 14, padding: [12, 20, 24, 20], align: 'center', distribute: 'start', width: 'fill', height: 'fill' },
  motion: { stagger: { each: 0.06, delay: 0.12, from: 'first' } },
  slots: {
    leading: [],
    trailing: [n('Button', {
      id: 'like', name: 'Like Button',
      props: { children: 'Favorite', variant: 'ghost', size: 'icon', icon: 'heart' },
      bind: { icon: "liked ? 'heart-fill' : 'heart'" },
      motion: {
        animate: "liked ? 'liked' : 'idle'",
        variants: {
          liked: { target: { scale: [1, 1.4, 1] }, transition: tweenSpec(0.42, 'easeOut') },
          idle: { target: { scale: 1 }, transition: T.snappy },
        },
      },
      on: { onPress: [act({ do: 'set', target: 'liked', value: '!liked' })] },
    })],
  },
  children: [
    n('Image', {
      id: 'plant-hero', name: 'Hero',
      props: { emoji: '🪴', from: '#A8E063', to: '#56AB2F' },
      bind: { emoji: 'plant.emoji' },
      layout: { width: 220, height: 220 },
      style: { radius: 60, shadow: 'lg' },
      motion: { layoutId: '`plant-${plant.id}`' },
    }),
    text('plant-name', 'Monstera', 'title1', { props: { align: 'center' }, bind: { children: 'plant.name' }, layout: { width: 'fit' }, motion: rise(12) }),
    n('TextMorph', {
      id: 'plant-status',
      props: { children: 'Needs water every 7 days', textStyle: 'subhead' },
      bind: { children: "watered ? 'Watered today 💧' : `Needs water every ${plant.every} days`" },
      motion: rise(12),
    }),
    n('Stack', {
      id: 'drop-stage',
      layout: { axis: 'overlay', align: 'center', distribute: 'center', width: 'fill', height: 44 },
      children: [text('drop', '💧', 'title1', {
        name: 'Water Drop', ref: 'drop',
        props: { align: 'center' },
        layout: { width: 'fit' },
        style: { opacity: 0 },
        motion: { variants: { splash: { target: { opacity: [0, 1, 1, 0], y: [16, -14, -18, -40], scale: [0.6, 1.2, 1, 0.8] }, transition: tweenSpec(0.9, 'easeOut') } } },
      })],
    }),
    n('Button', {
      id: 'water-now',
      props: { children: 'Water Now', size: 'pill' },
      bind: { children: "watered ? 'Watered' : 'Water Now'", isDisabled: 'watered' },
      layout: { width: 'fill' },
      motion: { ...rise(16), press: { target: { scale: 0.96 }, transition: T.snappy } },
      on: { onPress: [act({ do: 'animate', ref: 'drop', variant: 'splash' }), act({ do: 'set', target: 'watered', value: 'true' }), act({ do: 'call', prop: 'onWater', args: ['plant.id'] })] },
    }),
    n('ListSection', {
      id: 'plant-options',
      props: {},
      layout: { axis: 'vertical', width: 'fill' },
      motion: rise(16),
      children: [
        n('ListRow', {
          id: 'reminder-row',
          props: { title: 'Remind me', accessory: 'none' },
          slots: { leading: [n('Icon', { id: 'reminder-icon', props: { name: 'bell-fill', size: 20, color: '$warning' } })], accessory: [n('Switch', { id: 'reminder-switch', props: { 'aria-label': 'Remind me' }, bind: { checked: 'reminders' } })] },
        }),
        n('ListRow', { id: 'every-row', props: { title: 'Water every', accessory: 'none' }, bind: { trailing: '`${plant.every} days`' }, slots: { leading: [n('Icon', { id: 'every-icon', props: { name: 'drop', size: 20, color: '$primary' } })], accessory: [] } }),
      ],
    }),
  ],
}), {
  props: [
    { name: 'plant', type: 'object', default: "{ id: 1, name: 'Monstera', emoji: '🪴', every: 7, watered: false }" },
    { name: 'onWater', type: 'any', default: 'undefined', callback: true, params: ['id'] },
  ],
  state: [
    { name: 'watered', type: 'boolean', initial: 'plant.watered' },
    { name: 'liked', type: 'boolean', initial: 'false' },
    { name: 'reminders', type: 'boolean', initial: 'true' },
  ],
});

const schedule = scene('schedule', 'Schedule', COL * 2, ROW * 2, n('Screen', {
  id: 'schedule-root',
  props: { title: 'Schedule', largeTitle: true },
  layout: { axis: 'vertical', gap: 14, padding: [20, 16, 96, 16], align: 'start', distribute: 'start', width: 'fill', height: 'fill', overflow: 'scroll' },
  motion: { stagger: { each: 0.06, delay: 0.04, from: 'first' } },
  children: [
    text('schedule-title', 'Schedule', 'largeTitle', { motion: rise(10) }),
    n('Segmented', { id: 'schedule-range', props: { options: 'Week, Month', 'aria-label': 'Range' }, bind: { value: 'range' }, motion: rise(10) }),
    n('Calendar', { id: 'schedule-calendar', props: { variant: 'card', 'aria-label': 'Watering day' }, bind: { value: 'day' }, layout: { width: 'fill' }, motion: rise(14) }),
    text('schedule-day', 'Water on 2026-10-04', 'footnote', { props: { color: '$muted-foreground' }, bind: { children: '`Watering on ${day}: Monstera and Golden Pothos`' } }),
    n('ProgressStepper', { id: 'schedule-steps', props: { steps: 'Check soil:hand, Water:drop, Mist:cloud, Done:checkmark', current: 1 }, motion: rise(14) }),
  ],
}), {
  state: [
    { name: 'day', type: 'string', initial: "'2026-10-04'" },
    { name: 'range', type: 'string', initial: "'Week'" },
  ],
});

const settingsNav = navOf('settings-nav', 'SettingsNav', COL * 2, ROW * 3, 'settings');

const settings = scene('settings', 'Settings', COL * 3, ROW * 3, n('Screen', {
  id: 'settings-root',
  props: { title: 'Settings', largeTitle: true, grouped: true },
  layout: { axis: 'vertical', gap: 0, padding: [4, 16, 96, 16], align: 'start', distribute: 'start', width: 'fill', height: 'fill' },
  children: [
    n('ListSection', {
      id: 'settings-account',
      props: { title: 'Account' },
      layout: { axis: 'vertical', width: 'fill' },
      children: [
        n('ListRow', {
          id: 'account-row',
          props: { title: 'Signed in', accessory: 'none' },
          bind: { title: "session.user || 'Not signed in'" },
          slots: { leading: [n('Avatar', { id: 'account-avatar', props: { name: 'Ada Lovelace', size: 36 }, bind: { name: "session.user || 'Guest'" } })], accessory: [] },
        }),
        n('ListRow', {
          id: 'sign-out-row',
          props: { title: 'Sign Out', accessory: 'none', destructive: true },
          on: { onPress: [act({ do: 'set', target: 'session.user', value: "''" }), act({ do: 'segue', segue: 'to-welcome' })] },
          slots: { leading: [], accessory: [] },
        }),
      ],
    }),
    n('ListSection', {
      id: 'settings-notifications',
      props: { title: 'Notifications', footer: 'Reminders arrive at 8 AM on watering days.' },
      layout: { axis: 'vertical', width: 'fill' },
      children: [
        n('ListRow', {
          id: 'remind-row',
          props: { title: 'Watering reminders', accessory: 'none' },
          slots: { leading: [], accessory: [n('Switch', { id: 'remind-switch', props: { 'aria-label': 'Watering reminders' }, bind: { checked: 'reminders' } })] },
        }),
        n('ListRow', {
          id: 'units-row',
          props: { title: 'Units', trailing: 'Metric', accessory: 'chevron' },
          slots: { leading: [], accessory: [] },
        }),
      ],
    }),
  ],
}), { state: [{ name: 'reminders', type: 'boolean', initial: 'true' }] });

/* ── Add a plant: a sheet with its own NavigationStack ── */

const addPlantNav = navOf('add-nav', 'AddPlantNav', COL * 3, 0, 'add-plant', {
  props: [{ name: 'onAdd', type: 'any', default: 'undefined', callback: true, params: ['plant'] }],
}, { on: { onAdd: [act({ do: 'call', prop: 'onAdd', args: ['plant'] })] } });

const addPlant = scene('add-plant', 'AddPlant', COL * 4, 0, n('Screen', {
  id: 'add-root',
  props: { title: 'New Plant', largeTitle: false },
  layout: { axis: 'vertical', gap: 18, padding: [12, 20, 24, 20], align: 'center', distribute: 'start', width: 'fill', height: 'fill' },
  slots: {
    leading: [n('Button', { id: 'add-cancel', props: { children: 'Cancel', variant: 'link', size: 'default' }, on: { onPress: [act({ do: 'back' })] } })],
    trailing: [n('Button', {
      id: 'add-done',
      props: { children: 'Add', variant: 'link', size: 'default' },
      bind: { isDisabled: '!name.trim()' },
      on: { onPress: [act({ do: 'send', command: 'add' })] },
    })],
  },
  children: [
    n('Image', {
      id: 'add-preview',
      props: { emoji: '🌱', from: '#43E97B', to: '#38F9D7' },
      bind: { emoji: 'emoji' },
      layout: { width: 112, height: 112 },
      style: { radius: 32, shadow: 'md' },
      motion: { appear: { target: { opacity: 0, scale: 0.6, rotate: -12 }, transition: T.pop, trigger: 'mount', once: true } },
    }),
    n('Segmented', { id: 'add-emoji', props: { options: '🌱, 🌵, 🌸, 🍀, 🌻', 'aria-label': 'Kind' }, bind: { value: 'emoji' } }),
    n('TextField', {
      id: 'add-name', ref: 'nameField', autoFocus: true,
      props: { label: 'Name', placeholder: 'Monstera' },
      bind: { value: 'name' },
      on: { onSubmit: [act({ do: 'send', command: 'add' })] },
    }),
    n('Select', { id: 'add-every', props: { label: 'Water every', items: '3 days, 7 days, 14 days', placeholder: 'Choose…' }, bind: { value: 'every' } }),
  ],
}), {
  props: [{ name: 'onAdd', type: 'any', default: 'undefined', callback: true, params: ['plant'] }],
  state: [
    { name: 'name', type: 'string', initial: "''" },
    { name: 'emoji', type: 'string', initial: "'🌱'" },
    { name: 'every', type: 'string', initial: "'7 days'" },
  ],
  responds: {
    add: [
      act({ do: 'call', prop: 'onAdd', args: ['{ id: Date.now(), name: name.trim(), emoji, every: parseInt(every), watered: false }'], if: 'name.trim()' }),
      act({ do: 'back', if: 'name.trim()' }),
    ],
  },
});

export const SAMPLE_DOC: Doc = {
  version: 1,
  name: 'PlantPal',
  device: 'iphone',
  entry: 'welcome',
  scenes: [welcome, signInNav, signIn, mainTabs, gardenNav, garden, plantDetail, schedule, settingsNav, settings, addPlantNav, addPlant],
  segues: [
    { id: 'to-sign-in', identifier: 'showSignIn', from: 'welcome', to: 'sign-in-nav', kind: 'modal', transition: physicsSpec(520, 44), args: {}, delegates: {} },
    { id: 'to-main', identifier: 'showMain', from: 'sign-in', to: 'main', kind: 'replace', transition: tweenSpec(0.3, 'easeOut'), args: {}, delegates: {} },
    {
      id: 'to-plant', identifier: 'showPlant', from: 'garden', to: 'plant', kind: 'push', transition: physicsSpec(380, 40),
      args: { plant: 'plant' },
      delegates: { onWater: [act({ do: 'set', target: 'plants', value: 'plants.map((p) => p.id === id ? { ...p, watered: true } : p)' })] },
    },
    {
      id: 'to-add', identifier: 'showAddPlant', from: 'garden', to: 'add-nav', kind: 'modal', transition: physicsSpec(520, 44),
      args: {},
      delegates: { onAdd: [act({ do: 'set', target: 'plants', value: '[...plants, plant]' }), act({ do: 'toast', message: '`Added ${plant.name}`' })] },
    },
    { id: 'to-welcome', identifier: 'showWelcome', from: 'settings', to: 'welcome', kind: 'replace', transition: tweenSpec(0.3, 'easeOut'), args: {}, delegates: {} },
  ],
  contexts: [
    { id: 'session', name: 'SessionContext', alias: 'session', fields: [{ name: 'user', type: 'string', initial: "''" }] },
  ],
};

/* ── A second sample: a three-column SplitView, for iPad ── */

const MAILBOXES = "[{ id: 'inbox', name: 'Inbox', icon: 'tray', count: 3 }, { id: 'flagged', name: 'Flagged', icon: 'flag', count: 1 }, { id: 'sent', name: 'Sent', icon: 'paperplane', count: 0 }]";
const MESSAGES = `[
  { id: 1, from: 'Maya Lindqvist', subject: 'Repotting this weekend?', body: 'The monstera is root-bound again. Saturday morning?', box: 'inbox' },
  { id: 2, from: 'Jonas Ito', subject: 'Seed swap list', body: 'Attached the list for the October swap.', box: 'inbox' },
  { id: 3, from: 'Priya Raman', subject: 'Greenhouse keys', body: 'Left them with the front desk.', box: 'flagged' }
]`;

export const SPLIT_SAMPLE: Doc = {
  version: 1,
  name: 'Mail',
  device: 'ipad',
  entry: 'mail',
  scenes: [
    scene('mail', 'Mail', 0, 0, n('SplitView', {
      id: 'mail-root',
      props: { widthClass: 'auto', sidebarBehavior: 'auto' },
      slots: {
        sidebar: [n('SceneRef', { id: 'mail-sidebar', props: { scene: 'mailboxes-nav' } })],
        supplementary: [n('SceneRef', { id: 'mail-list', props: { scene: 'messages-nav' } })],
        detail: [n('SceneRef', { id: 'mail-detail', props: { scene: 'message' } })],
      },
    })),
    navOf('mailboxes-nav', 'MailboxesNav', 900, 0, 'mailboxes'),
    navOf('messages-nav', 'MessagesNav', 900, 1300, 'messages'),
    scene('mailboxes', 'Mailboxes', 1800, 0, n('Screen', {
      id: 'mailboxes-root',
      props: { title: 'Mailboxes', largeTitle: true, grouped: true },
      layout: { axis: 'vertical', gap: 0, padding: [4, 12, 24, 12], align: 'start', width: 'fill', height: 'fill' },
      children: [n('ListSection', {
        id: 'mailbox-list', props: {}, layout: { axis: 'vertical', width: 'fill' },
        children: [n('ListRow', {
          id: 'mailbox-row', props: { title: 'Inbox', accessory: 'chevron' },
          bind: { title: 'box.name', trailing: "box.count ? String(box.count) : ''" },
          repeat: { each: 'boxes', as: 'box', key: 'box.id' },
          slots: { leading: [n('Icon', { id: 'mailbox-icon', props: { name: 'tray', size: 20, color: '$primary' }, bind: { name: 'box.icon' } })], accessory: [] },
        })],
      })],
    }), { state: [{ name: 'boxes', type: 'list', initial: MAILBOXES }] }),
    scene('messages', 'Messages', 1800, 1300, n('Screen', {
      id: 'messages-root',
      props: { title: 'Inbox', largeTitle: true },
      layout: { axis: 'vertical', gap: 0, padding: [4, 0, 24, 0], align: 'start', width: 'fill', height: 'fill' },
      children: [n('ListSection', {
        id: 'message-list', props: {}, layout: { axis: 'vertical', width: 'fill' },
        children: [n('ListRow', {
          id: 'message-row', props: { title: 'From', subtitle: 'Subject', accessory: 'none' },
          bind: { title: 'm.from', subtitle: 'm.subject' },
          repeat: { each: 'messages', as: 'm', key: 'm.id' },
          on: { onPress: [act({ do: 'segue', segue: 'to-message' })] },
          slots: { leading: [n('Avatar', { id: 'message-avatar', props: { name: 'Maya', size: 36 }, bind: { name: 'm.from' } })], accessory: [] },
        })],
      })],
    }), { state: [{ name: 'messages', type: 'list', initial: MESSAGES }] }),
    scene('message', 'Message', 2700, 650, n('Screen', {
      id: 'message-root',
      props: { title: '', largeTitle: false },
      bind: { title: 'message.subject' },
      layout: { axis: 'vertical', gap: 12, padding: [16, 24, 24, 24], align: 'start', width: 'fill', height: 'fill' },
      children: [
        n('Stack', {
          id: 'message-head', layout: { axis: 'horizontal', gap: 12, align: 'center', width: 'fill' },
          children: [
            n('Avatar', { id: 'message-from-avatar', props: { name: 'Maya', size: 44 }, bind: { name: 'message.from' } }),
            n('Stack', { id: 'message-from', layout: { axis: 'vertical', gap: 2, align: 'start', width: 'fill' }, children: [
              text('message-from-name', 'From', 'headline', { bind: { children: 'message.from' } }),
              text('message-subject', 'Subject', 'subhead', { props: { color: '$muted-foreground' }, bind: { children: 'message.subject' } }),
            ] }),
          ],
        }),
        n('Separator', { id: 'message-rule' }),
        text('message-body', 'Body', 'body', { bind: { children: 'message.body' } }),
      ],
    }), {
      props: [{ name: 'message', type: 'object', default: "{ id: 0, from: 'Maya Lindqvist', subject: 'Repotting this weekend?', body: 'The monstera is root-bound again. Saturday morning?' }" }],
    }),
  ],
  segues: [
    { id: 'to-message', identifier: 'showMessage', from: 'messages', to: 'message', kind: 'detail', transition: physicsSpec(380, 40), args: { message: 'm' }, delegates: {} },
  ],
  contexts: [],
};

/** A storyboard with one empty screen. */
export function blankDoc(): Doc {
  return {
    version: 1,
    name: 'Untitled',
    device: 'iphone',
    entry: 'blank',
    scenes: [scene('blank', 'ContentView', 0, 0, n('Screen', { id: 'blank-root', props: { title: 'Untitled', largeTitle: true } }))],
    segues: [],
    contexts: [],
  };
}
