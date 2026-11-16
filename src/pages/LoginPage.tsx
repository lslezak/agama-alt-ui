import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  InputGroup,
  InputGroupItem,
  TextInput,
} from "@patternfly/react-core";
import EyeIcon from "@patternfly/react-icons/dist/esm/icons/eye-icon";
import EyeSlashIcon from "@patternfly/react-icons/dist/esm/icons/eye-slash-icon";
import LockIcon from "@patternfly/react-icons/dist/esm/icons/lock-icon";
import { motion, useAnimationControls } from "framer-motion";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { NetworkError, UnauthorizedError } from "../api/client";
import { useSession } from "../context/SessionContext";

export function loginErrorMessage(error: unknown): string {
  if (error instanceof UnauthorizedError) return "Wrong password.";
  if (error instanceof NetworkError) return `Cannot reach the server: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

/** Step 3: authenticate as root. */
export function LoginPage() {
  const { login, notice, serverUrl } = useSession();
  const navigate = useNavigate();
  const shake = useAnimationControls();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(password);
      navigate("/products");
    } catch (e) {
      setError(loginErrorMessage(e));
      void shake.start({ x: [0, -14, 14, -10, 10, -5, 5, 0], transition: { duration: 0.5 } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page--narrow">
      <div className="hero">
        <motion.div
          className="trust-icon"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 150, damping: 12 }}
        >
          <LockIcon />
        </motion.div>
        <h2 className="page__title">Log in</h2>
        <p className="subtitle">
          Enter the <strong>root</strong> password of {serverUrl}
        </p>
      </div>

      <motion.div animate={shake}>
        <Form onSubmit={(e) => void submit(e)}>
          {notice && <Alert variant="warning" isInline title={notice} />}

          <FormGroup label="Password" fieldId="password">
            <InputGroup>
              <InputGroupItem isFill>
                <TextInput
                  id="password"
                  type={visible ? "text" : "password"}
                  value={password}
                  onChange={(_e, v) => setPassword(v)}
                  autoFocus
                  isDisabled={busy}
                  validated={error ? "error" : "default"}
                />
              </InputGroupItem>
              <InputGroupItem>
                <Button
                  variant="control"
                  title={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible((v) => !v)}
                  icon={visible ? <EyeSlashIcon /> : <EyeIcon />}
                />
              </InputGroupItem>
            </InputGroup>
          </FormGroup>

          {error && <Alert variant="danger" isInline title={error} />}

          <ActionGroup>
            <Button type="submit" variant="primary" size="lg" isLoading={busy} isDisabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </Button>
            <Button variant="link" onClick={() => navigate("/")}>
              Change server
            </Button>
          </ActionGroup>
        </Form>
      </motion.div>
    </div>
  );
}
