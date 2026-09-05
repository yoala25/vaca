import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./CompanyPolicyForm.module.css";
import { usePlanner } from "../../state/PlannerContext";
import {
  HOURLY_UNIT_OPTIONS,
  LEAVE_EXPIRY_PRESETS,
  describeLeaveExpiry,
  totalLeaveDays,
  type CompanyHolidayEntry,
  type CompanyPolicy,
  type ExtraLeaveEntry,
  type LeaveExpiryPreset,
} from "../../data/companyPolicy";
import { asLocalDate, formatDateRange } from "../../domain/vacation";
import {
  sanitizeLeaveDays,
  sanitizeShortText,
  sanitizeWorkMinutes,
} from "../../lib/validation";

const EXTRA_LEAVE_PRESETS = ["리프레시휴가", "안식휴가", "장기근속휴가", "보상휴가"];

export function CompanyPolicyForm() {
  const navigate = useNavigate();
  const { companyPolicy, updateCompanyPolicy, today } = usePlanner();

  // 저장 버튼을 누를 때까지 홈 화면에 반영되지 않도록 초안 상태로 편집한다.
  const [draft, setDraft] = useState<CompanyPolicy>(companyPolicy);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addingHoliday, setAddingHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");

  const [extraName, setExtraName] = useState(EXTRA_LEAVE_PRESETS[0]);
  const [extraDays, setExtraDays] = useState("15");

  useEffect(() => setDraft(companyPolicy), [companyPolicy]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(companyPolicy);
  const patch = (changes: Partial<CompanyPolicy>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setSavedAt(null);
  };

  const save = () => {
    updateCompanyPolicy(draft);
    setSavedAt(Date.now());
    setError(null);
  };

  const addExtraLeave = () => {
    const name = sanitizeShortText(extraName);
    const days = sanitizeLeaveDays(extraDays, 0);
    if (!name || days <= 0) {
      setError("휴가 이름과 일수를 확인해 주세요.");
      return;
    }
    const entry: ExtraLeaveEntry = {
      id: `extra-${Date.now()}`,
      name,
      days,
    };
    patch({ extraLeaves: [...draft.extraLeaves, entry] });
    setExtraDays("15");
    setError(null);
  };

  const addHoliday = () => {
    const name = sanitizeShortText(holidayName);
    if (!name || !holidayStart) {
      setError("휴무일 이름과 시작일을 입력해 주세요.");
      return;
    }
    try {
      const startDate = asLocalDate(holidayStart);
      const endDate = holidayEnd ? asLocalDate(holidayEnd) : startDate;
      if (endDate < startDate) {
        setError("종료일이 시작일보다 빠를 수 없어요.");
        return;
      }
      const entry: CompanyHolidayEntry = {
        id: `company-${Date.now()}`,
        name,
        startDate,
        endDate,
        recurring: false,
      };
      patch({ companyHolidays: [...draft.companyHolidays, entry] });
      setHolidayName("");
      setHolidayStart("");
      setHolidayEnd("");
      setAddingHoliday(false);
      setError(null);
    } catch {
      setError("날짜 형식이 올바르지 않아요.");
    }
  };

  return (
    <>
      <div className={styles.grid}>
        <section className={styles.card}>
          <p className={styles.cardTitle}>보유 휴가</p>

          <div className={styles.row}>
            <span className={styles.rowIcon}>🌴</span>
            <span className={styles.rowLabel}>기본 연차</span>
            <input
              className={styles.rowValueInput}
              type="number"
              min={0}
              max={60}
              step={0.5}
              value={draft.baseLeaveDays}
              onChange={(event) =>
                patch({ baseLeaveDays: sanitizeLeaveDays(event.target.value, draft.baseLeaveDays) })
              }
              aria-label="기본 연차 일수"
            />
            <span className={styles.rowUnit}>일</span>
          </div>

          {draft.extraLeaves.map((entry) => (
            <div key={entry.id} className={styles.row}>
              <span className={styles.rowIcon}>🎁</span>
              <span className={styles.rowLabel}>{entry.name}</span>
              <span className={styles.rowValue}>+{entry.days}일</span>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() =>
                  patch({ extraLeaves: draft.extraLeaves.filter((e) => e.id !== entry.id) })
                }
              >
                삭제
              </button>
            </div>
          ))}

          <div className={styles.addForm}>
            <input
              className={styles.addInput}
              list="extra-leave-presets"
              placeholder="휴가 이름"
              value={extraName}
              onChange={(event) => setExtraName(event.target.value)}
              aria-label="추가 휴가 이름"
            />
            <datalist id="extra-leave-presets">
              {EXTRA_LEAVE_PRESETS.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <input
              className={styles.addInput}
              type="number"
              min={0.5}
              max={60}
              step={0.5}
              value={extraDays}
              onChange={(event) => setExtraDays(event.target.value)}
              aria-label="추가 휴가 일수"
            />
            <button type="button" className={styles.addConfirm} onClick={addExtraLeave}>
              추가
            </button>
          </div>

          <p className={styles.totalRow}>
            전체 휴가 <strong>{totalLeaveDays(draft)}일</strong>
            {draft.extraLeaves.length > 0 && (
              <span className={styles.totalBreakdown}>
                (기본 {draft.baseLeaveDays}일 +{" "}
                {draft.extraLeaves.map((e) => `${e.name} ${e.days}일`).join(" + ")})
              </span>
            )}
          </p>

          <div className={styles.row}>
            <span className={styles.rowIcon}>🕐</span>
            <span className={styles.rowLabel}>반차 (오전/오후)</span>
            <button
              type="button"
              className={`${styles.switch} ${draft.halfDayEnabled ? styles.switchOn : ""}`}
              aria-pressed={draft.halfDayEnabled}
              aria-label="반차 사용 가능"
              onClick={() => patch({ halfDayEnabled: !draft.halfDayEnabled })}
            >
              <span className={styles.switchKnob} />
            </button>
          </div>

          <div className={styles.row}>
            <span className={styles.rowIcon}>⏱️</span>
            <span className={styles.rowLabel}>시간차 휴가</span>
            <select
              className={styles.rowSelect}
              value={draft.hourlyUnitMinutes ?? ""}
              onChange={(event) =>
                patch({
                  hourlyUnitMinutes:
                    HOURLY_UNIT_OPTIONS.find(
                      (option) => String(option.value ?? "") === event.target.value,
                    )?.value ?? null,
                })
              }
              aria-label="시간차 단위"
            >
              {HOURLY_UNIT_OPTIONS.map((option) => (
                <option key={option.label} value={option.value ?? ""}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <span className={styles.rowIcon}>💼</span>
            <span className={styles.rowLabel}>하루 근무시간</span>
            <input
              className={styles.rowValueInput}
              type="number"
              min={1}
              max={12}
              step={0.5}
              value={draft.dailyWorkMinutes / 60}
              onChange={(event) =>
                patch({
                  dailyWorkMinutes: sanitizeWorkMinutes(
                    Number(event.target.value) * 60,
                    draft.dailyWorkMinutes,
                  ),
                })
              }
              aria-label="하루 근무시간"
            />
            <span className={styles.rowUnit}>시간</span>
          </div>
        </section>

        <section className={styles.card}>
          <p className={styles.cardTitle}>연차 소멸 기한</p>
          <p className={styles.emptyHint}>
            이 날짜까지 못 쓴 연차는 소멸하거나 수당으로 정산돼요. 추천은 이 기한 안에서만
            계산합니다.
          </p>

          <div className={styles.row}>
            <span className={styles.rowIcon}>⌛</span>
            <span className={styles.rowLabel}>소멸 기준</span>
            <select
              className={styles.rowSelect}
              value={draft.leaveExpiryPreset}
              onChange={(event) =>
                patch({ leaveExpiryPreset: event.target.value as LeaveExpiryPreset })
              }
              aria-label="연차 소멸 기준"
            >
              {LEAVE_EXPIRY_PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {draft.leaveExpiryPreset === "custom" && (
            <div className={styles.row}>
              <span className={styles.rowIcon}>📅</span>
              <span className={styles.rowLabel}>소멸일</span>
              <input
                className={styles.rowSelect}
                type="date"
                value={draft.leaveExpiryCustomDate ?? ""}
                onChange={(event) => patch({ leaveExpiryCustomDate: event.target.value || null })}
                aria-label="연차 소멸일"
              />
            </div>
          )}

          <p className={styles.expiryResult}>
            적용 기준: <strong>{describeLeaveExpiry(draft, today)}</strong>까지
          </p>
        </section>

        <section className={styles.card}>
          <p className={styles.cardTitle}>회사 지정 휴무일</p>

          {draft.companyHolidays.length === 0 && !addingHoliday && (
            <p className={styles.emptyHint}>
              창립기념일·여름휴무처럼 회사가 지정한 휴일을 추가하면 더 정확하게 계산해요.
            </p>
          )}

          {draft.companyHolidays.map((entry) => (
            <div key={entry.id} className={styles.row}>
              <span className={styles.rowIcon}>📌</span>
              <span className={styles.rowLabel}>{entry.name}</span>
              <span className={styles.rowValue}>
                {formatDateRange(entry.startDate, entry.endDate)}
              </span>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() =>
                  patch({
                    companyHolidays: draft.companyHolidays.filter((e) => e.id !== entry.id),
                  })
                }
              >
                삭제
              </button>
            </div>
          ))}

          {addingHoliday ? (
            <div className={styles.addForm}>
              <input
                className={styles.addInput}
                placeholder="휴무일 이름"
                value={holidayName}
                onChange={(event) => setHolidayName(event.target.value)}
              />
              <input
                className={styles.addInput}
                type="date"
                value={holidayStart}
                onChange={(event) => setHolidayStart(event.target.value)}
                aria-label="시작일"
              />
              <input
                className={styles.addInput}
                type="date"
                value={holidayEnd}
                onChange={(event) => setHolidayEnd(event.target.value)}
                aria-label="종료일 (선택)"
              />
              <button type="button" className={styles.addConfirm} onClick={addHoliday}>
                추가
              </button>
            </div>
          ) : (
            <button type="button" className={styles.addRow} onClick={() => setAddingHoliday(true)}>
              + 휴무일 추가
            </button>
          )}
        </section>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.saveBar}>
        <span className={styles.saveHint}>
          {savedAt
            ? "저장했어요. 휴가 설계에 반영됐습니다."
            : isDirty
              ? "변경사항이 아직 저장되지 않았어요."
              : "전체 휴가일수와 소멸 기한이 휴가 설계에 반영됩니다."}
        </span>
        <div className={styles.saveActions}>
          {isDirty && (
            <button
              type="button"
              className={styles.resetBtn}
              onClick={() => setDraft(companyPolicy)}
            >
              되돌리기
            </button>
          )}
          <button type="button" className={styles.saveBtn} disabled={!isDirty} onClick={save}>
            저장하기
          </button>
          {savedAt && (
            <button type="button" className={styles.goHomeBtn} onClick={() => navigate("/")}>
              휴가 설계로 이동 ›
            </button>
          )}
        </div>
      </div>
    </>
  );
}
