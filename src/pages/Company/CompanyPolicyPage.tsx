import styles from "../../styles/pageHeader.module.css";
import { CompanyPolicyForm } from "../../features/company/CompanyPolicyForm";

export function CompanyPolicyPage() {
  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>우리 회사 휴가제도</h1>
        <p className={styles.desc}>
          회사 휴가제도를 등록하면 더 정확한 휴가 조합을 찾아드려요.
        </p>
      </div>
      <CompanyPolicyForm />
    </div>
  );
}
