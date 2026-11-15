'use client';
/* @internal: how many months the host shows, for CalendarMonths: a Calendar and a DatePicker provide their `months`,
   so CalendarMonths draws the right number of grids in either without being told again. Registry installs copy it
   with the Calendar; it has no npm entry. */
import { createContext } from 'react';

export const CalendarMonthsContext = createContext(1);
