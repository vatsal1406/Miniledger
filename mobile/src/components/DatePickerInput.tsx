import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BorderRadius, Spacing } from '../constants/theme';
import { formatDate } from '../utils/format';

interface DatePickerInputProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  error?: string | null;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  label = 'Due Date *',
  error,
}) => {
  const [showModal, setShowModal] = useState(false);

  // Fallback safe date
  const safeDate = value instanceof Date && !isNaN(value.getTime()) ? value : new Date();

  const [viewingYear, setViewingYear] = useState(safeDate.getFullYear());
  const [viewingMonth, setViewingMonth] = useState(safeDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(safeDate));

  const openCalendar = () => {
    const valid = value instanceof Date && !isNaN(value.getTime()) ? value : new Date();
    setSelectedDate(new Date(valid));
    setViewingYear(valid.getFullYear());
    setViewingMonth(valid.getMonth());
    setShowModal(true);
  };

  const handlePrevMonth = () => {
    if (viewingMonth === 0) {
      setViewingMonth(11);
      setViewingYear((y) => y - 1);
    } else {
      setViewingMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewingMonth === 11) {
      setViewingMonth(0);
      setViewingYear((y) => y + 1);
    } else {
      setViewingMonth((m) => m + 1);
    }
  };

  const handlePrevYear = () => {
    setViewingYear((y) => y - 1);
  };

  const handleNextYear = () => {
    setViewingYear((y) => y + 1);
  };

  const handleSelectDay = (day: number) => {
    const d = new Date(viewingYear, viewingMonth, day);
    setSelectedDate(d);
  };

  const handleConfirm = () => {
    onChange(selectedDate);
    setShowModal(false);
  };

  // Quick preset helpers
  const setDaysFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    onChange(d);
    setSelectedDate(d);
    setViewingYear(d.getFullYear());
    setViewingMonth(d.getMonth());
  };

  // Calendar calculations
  const daysInMonth = new Date(viewingYear, viewingMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewingYear, viewingMonth, 1).getDay();
  const today = new Date();

  const isSameDay = (d1: Date, y: number, m: number, d: number) => {
    return (
      d1.getFullYear() === y &&
      d1.getMonth() === m &&
      d1.getDate() === d
    );
  };

  // Format full display date, e.g. "Fri, 7 Nov 2026"
  const formattedDisplay = (d: Date) => {
    if (!d || isNaN(d.getTime())) return 'Select due date';
    try {
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return formatDate(d);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Main Trigger Input Box */}
      <Pressable
        style={[styles.inputBox, error ? styles.inputError : null]}
        onPress={openCalendar}
        accessibilityRole="button"
        accessibilityLabel="Choose custom due date">
        <View style={styles.dateDisplayRow}>
          <Text style={styles.calendarIcon}>📅</Text>
          <Text style={styles.dateText}>{formattedDisplay(value)}</Text>
        </View>
        <View style={styles.chooseActionBadge}>
          <Text style={styles.chooseActionText}>Select Date</Text>
        </View>
      </Pressable>

      {/* Preset shortcut chips */}
      <View style={styles.presetsRow}>
        <Pressable style={styles.presetChip} onPress={() => setDaysFromNow(7)}>
          <Text style={styles.presetText}>+1 Week</Text>
        </Pressable>
        <Pressable style={styles.presetChip} onPress={() => setDaysFromNow(14)}>
          <Text style={styles.presetText}>+2 Weeks</Text>
        </Pressable>
        <Pressable style={styles.presetChip} onPress={() => setDaysFromNow(30)}>
          <Text style={styles.presetText}>+1 Month</Text>
        </Pressable>
        <Pressable style={styles.presetChip} onPress={() => setDaysFromNow(90)}>
          <Text style={styles.presetText}>+3 Months</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Interactive Calendar Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Due Date</Text>
                <Text style={styles.modalSubtitle}>{formattedDisplay(selectedDate)}</Text>
              </View>
              <Pressable
                style={styles.closeIconBtn}
                onPress={() => setShowModal(false)}
                hitSlop={10}>
                <Text style={styles.closeIconText}>✕</Text>
              </Pressable>
            </View>

            {/* Month & Year Navigation Bar */}
            <View style={styles.navBar}>
              <View style={styles.navArrowsGroup}>
                <Pressable
                  style={styles.navBtn}
                  onPress={handlePrevYear}
                  hitSlop={8}
                  accessibilityLabel="Previous Year">
                  <Text style={styles.navBtnDoubleText}>«</Text>
                </Pressable>
                <Pressable
                  style={styles.navBtn}
                  onPress={handlePrevMonth}
                  hitSlop={8}
                  accessibilityLabel="Previous Month">
                  <Text style={styles.navBtnText}>‹</Text>
                </Pressable>
              </View>

              <Text style={styles.monthYearTitle}>
                {MONTH_NAMES[viewingMonth]} {viewingYear}
              </Text>

              <View style={styles.navArrowsGroup}>
                <Pressable
                  style={styles.navBtn}
                  onPress={handleNextMonth}
                  hitSlop={8}
                  accessibilityLabel="Next Month">
                  <Text style={styles.navBtnText}>›</Text>
                </Pressable>
                <Pressable
                  style={styles.navBtn}
                  onPress={handleNextYear}
                  hitSlop={8}
                  accessibilityLabel="Next Year">
                  <Text style={styles.navBtnDoubleText}>»</Text>
                </Pressable>
              </View>
            </View>

            {/* Quick Jumps Row inside modal */}
            <View style={styles.quickJumpsRow}>
              <Pressable
                style={styles.quickJumpBtn}
                onPress={() => {
                  const now = new Date();
                  setSelectedDate(now);
                  setViewingYear(now.getFullYear());
                  setViewingMonth(now.getMonth());
                }}>
                <Text style={styles.quickJumpText}>Today</Text>
              </Pressable>
              <Pressable
                style={styles.quickJumpBtn}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  setSelectedDate(d);
                  setViewingYear(d.getFullYear());
                  setViewingMonth(d.getMonth());
                }}>
                <Text style={styles.quickJumpText}>+1W</Text>
              </Pressable>
              <Pressable
                style={styles.quickJumpBtn}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 14);
                  setSelectedDate(d);
                  setViewingYear(d.getFullYear());
                  setViewingMonth(d.getMonth());
                }}>
                <Text style={styles.quickJumpText}>+2W</Text>
              </Pressable>
              <Pressable
                style={styles.quickJumpBtn}
                onPress={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + 1);
                  setSelectedDate(d);
                  setViewingYear(d.getFullYear());
                  setViewingMonth(d.getMonth());
                }}>
                <Text style={styles.quickJumpText}>+1M</Text>
              </Pressable>
              <Pressable
                style={styles.quickJumpBtn}
                onPress={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + 3);
                  setSelectedDate(d);
                  setViewingYear(d.getFullYear());
                  setViewingMonth(d.getMonth());
                }}>
                <Text style={styles.quickJumpText}>+3M</Text>
              </Pressable>
            </View>

            {/* Weekdays Row */}
            <View style={styles.weekdaysRow}>
              {WEEKDAY_NAMES.map((w, idx) => (
                <View key={idx} style={styles.weekdayCell}>
                  <Text style={[styles.weekdayText, (idx === 0 || idx === 6) && styles.weekendText]}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {/* Padding before day 1 */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <View key={`empty-${idx}`} style={styles.dayCell} />
              ))}

              {/* Day numbers */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const isSelected = isSameDay(selectedDate, viewingYear, viewingMonth, dayNum);
                const isCurrentToday = isSameDay(today, viewingYear, viewingMonth, dayNum);

                return (
                  <Pressable
                    key={`day-${dayNum}`}
                    style={[
                      styles.dayCell,
                      isCurrentToday && !isSelected && styles.todayCell,
                      isSelected && styles.selectedDayCell,
                    ]}
                    onPress={() => handleSelectDay(dayNum)}>
                    <Text
                      style={[
                        styles.dayText,
                        isCurrentToday && !isSelected && styles.todayText,
                        isSelected && styles.selectedDayText,
                      ]}>
                      {dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Modal Bottom Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmBtn}
                onPress={handleConfirm}>
                <Text style={styles.confirmBtnText}>Apply Due Date</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.three,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: Spacing.one,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  dateDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  calendarIcon: {
    fontSize: 18,
  },
  chooseActionBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chooseActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F172A',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  presetChip: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.two + 2,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },

  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#0D9488',
    fontWeight: '600',
    marginTop: 2,
  },
  closeIconBtn: {
    padding: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
  },
  closeIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: Spacing.two,
  },
  navArrowsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  navBtnDoubleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  monthYearTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickJumpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
    gap: 4,
  },
  quickJumpBtn: {
    flex: 1,
    paddingVertical: 4,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickJumpText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  weekendText: {
    color: '#CBD5E1',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.three,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
    marginVertical: 2,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  todayText: {
    color: '#0D9488',
    fontWeight: '700',
  },
  selectedDayCell: {
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.md,
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.two + 4,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1.5,
    paddingVertical: Spacing.two + 4,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: '#0F172A',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
