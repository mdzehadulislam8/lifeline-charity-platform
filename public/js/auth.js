// ====================================
// AUTHENTICATION - login.html & signup.html
// ====================================

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const userTypeRadios = document.querySelectorAll('input[name="userType"]');
    const bloodTypeGroup = document.getElementById('bloodTypeGroup');
    const adminNidGroup = document.getElementById('adminNidGroup');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // Login Form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Signup Form
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);

        // Show/hide fields based on user type
        if (userTypeRadios.length > 0) {
            userTypeRadios.forEach(radio => {
                radio.addEventListener('change', function () {
                    // Hide all conditional groups first
                    if (bloodTypeGroup) bloodTypeGroup.style.display = 'none';
                    if (adminNidGroup) adminNidGroup.style.display = 'none';

                    // Show relevant fields (admin role removed)
                    if (this.value === 'blood_donor') {
                        if (bloodTypeGroup) {
                            bloodTypeGroup.style.display = 'block';
                            document.getElementById('bloodType').required = true;
                        }
                    } else {
                        if (bloodTypeGroup) document.getElementById('bloodType').required = false;
                    }
                });
            });
        }

        // Password strength meter
        if (passwordInput) {
            passwordInput.addEventListener('input', checkPasswordStrength);
        }

        // Password confirmation
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('change', validatePasswords);
        }
    }
});

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const selectedRoleEl = document.getElementById('loginRole');
    const selectedRole = selectedRoleEl ? selectedRoleEl.value : null;

    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    showLoader();

    try {
        const response = await api.loginUser(email, password, selectedRole);

        hideLoader();

        if (response === null) {
            // API client already displayed an error notification
            return;
        }

        if (response && response.token && response.user) {
            api.setToken(response.token);
            setCurrentUser(response.user);
            showNotification('Login successful!', 'success');

            // If login came from a protected page the URL may contain ?returnTo=...
            const urlParams = new URLSearchParams(window.location.search);
            const returnTo = urlParams.get('returnTo');

            setTimeout(() => {
                if (returnTo) {
                    window.location.href = returnTo;
                    return;
                }

                // Redirect based on user type (admin route removed)
                const userType = response.user.userType;
                if (userType === 'doctor') {
                    window.location.href = '/lifeline-charity-team-dashboard.html';
                } else if (userType === 'patient') {
                    window.location.href = '/submission.html';
                } else {
                    window.location.href = '/';
                }
            }, 1500);
        } else {
            showNotification('Invalid email or password', 'error');
        }
    } catch (error) {
        hideLoader();
        showNotification('Login failed: ' + error.message, 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const userType = document.querySelector('input[name="userType"]:checked').value;
    const terms = document.getElementById('terms').checked;

    // Validation
    if (!firstName || !lastName || !email || !phone || !password) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    if (!terms) {
        showNotification('Please accept the terms and conditions', 'error');
        return;
    }

    if (password.length < 8) {
        showNotification('Password must be at least 8 characters', 'error');
        return;
    }

    showLoader();

    const userData = {
        firstName,
        lastName,
        email,
        phone,
        password,
        userType,
        username: email.split('@')[0]
    };

    // Add type-specific fields
    if (userType === 'blood_donor') {
        const bloodType = document.getElementById('bloodType').value;
        if (!bloodType) {
            hideLoader();
            showNotification('Please select your blood type', 'error');
            return;
        }
        userData.bloodType = bloodType;
    } else if (userType === 'doctor') {
        // No special fields required for charity team members
    }

    try {
        // Convert to FormData to support file uploads
        const formData = new FormData();
        
        // Add all fields to FormData
        Object.keys(userData).forEach(key => {
            formData.append(key, userData[key]);
        });
        
        // Add profile photo if provided
        const profilePhotoInput = document.getElementById('profilePhoto');
        if (profilePhotoInput && profilePhotoInput.files && profilePhotoInput.files[0]) {
            formData.append('profilePhoto', profilePhotoInput.files[0]);
        }
        
        const response = await api.registerUser(formData);

        hideLoader();

        // If the API client returns null it already displayed an error notification
        if (response === null) {
            // keep the form intact for correction (do not clear)
            return;
        }

        if (response && response.user && response.token) {
            api.setToken(response.token);
            setCurrentUser(response.user);
            showNotification('Account created successfully! Redirecting...', 'success');

            setTimeout(() => {
                if (response.user.userType === 'doctor') {
                    window.location.href = '/lifeline-charity-team-dashboard.html';
                } else {
                    window.location.href = '/';
                }
            }, 2000);
        } else {
            // Unexpected shape - show what's available
            const msg = response?.message || JSON.stringify(response) || 'Registration failed. Please try again.';
            showNotification(msg, 'error');
            console.error('Registration failed (unexpected response):', response);
        }
    } catch (error) {
        hideLoader();
        // Keep the form intact so user can correct inputs; show detailed error
        showNotification('Registration error: ' + (error.message || 'Unknown error'), 'error');
        console.error('Signup error:', error);
    }
}

function checkPasswordStrength() {
    const password = document.getElementById('password').value;
    const strengthMeter = document.getElementById('strengthMeter');

    let strength = 'Weak';
    let color = '#e74c3c'; // Red

    if (password.length >= 8) {
        if (password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*]/.test(password)) {
            strength = 'Strong';
            color = '#27ae60'; // Green
        } else if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
            strength = 'Medium';
            color = '#f39c12'; // Orange
        }
    }

    strengthMeter.textContent = strength;
    strengthMeter.style.color = color;
}

function validatePasswords() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password && confirmPassword && password !== confirmPassword) {
        showNotification('Passwords do not match', 'warning');
    }
}
